import shutil
import sqlite3
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError
from fastapi.testclient import TestClient

# Add app to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.routers.file_host as file_host_router
import app.services.r2_storage_service as r2_service
from app.main import app
from app.services.r2_storage_service import (
    MAX_HOSTING_FILE_SIZE,
    cleanup_expired_files_job,
    complete_multipart_session,
    confirm_upload_session,
    consume_local_stream_token,
    create_upload_session,
    delete_hosted_file,
    get_db,
    get_file_metadata,
    init_db,
    prepare_download,
)

_TEST_TMP_DIR = tempfile.TemporaryDirectory()
_ORIG_DB_PATH = r2_service.DB_PATH
_ORIG_SERVICE_HOSTING_DIR = r2_service.HOSTING_DIR
_ORIG_ROUTER_HOSTING_DIR = file_host_router.HOSTING_DIR


def setUpModule():
    tmp_root = Path(_TEST_TMP_DIR.name)
    r2_service.DB_PATH = tmp_root / "test_file_host.db"
    r2_service.HOSTING_DIR = tmp_root / "hosted_files"
    file_host_router.HOSTING_DIR = r2_service.HOSTING_DIR
    r2_service.HOSTING_DIR.mkdir(parents=True, exist_ok=True)
    init_db()


def tearDownModule():
    r2_service.DB_PATH = _ORIG_DB_PATH
    r2_service.HOSTING_DIR = _ORIG_SERVICE_HOSTING_DIR
    file_host_router.HOSTING_DIR = _ORIG_ROUTER_HOSTING_DIR
    _TEST_TMP_DIR.cleanup()


def _purge_test_row(file_id: str) -> None:
    """Removes test file rows and local temp folders so tests leave no artifacts behind."""
    with get_db() as conn:
        conn.execute("DELETE FROM download_tokens WHERE file_id = ?", (file_id,))
        conn.execute("DELETE FROM file_reports WHERE file_id = ?", (file_id,))
        conn.execute("DELETE FROM hosted_files WHERE id = ?", (file_id,))
    local_dir = r2_service.HOSTING_DIR / file_id
    if local_dir.exists():
        shutil.rmtree(local_dir, ignore_errors=True)


class TestFileHosting(unittest.TestCase):
    def setUp(self):
        self.created_ids = []

    def tearDown(self):
        for fid in self.created_ids:
            _purge_test_row(fid)

    def test_create_session_success(self):
        """Test initializing an anonymous upload session with default 24-hour (1-day) expiration."""
        session = create_upload_session(
            filename="my_document.pdf",
            file_size=1024 * 500,  # 500KB
        )
        self.created_ids.append(session["file_id"])
        self.assertIn("file_id", session)
        self.assertIn("delete_token", session)
        self.assertEqual(session["filename"], "my_document.pdf")
        self.assertEqual(session["expiry_days"], 1)
        self.assertIn("upload_url", session)

        # Verify metadata retrieval
        meta = get_file_metadata(session["file_id"])
        self.assertIsNotNone(meta)
        self.assertEqual(meta["filename"], "my_document.pdf")
        self.assertEqual(meta["file_size"], 1024 * 500)
        self.assertFalse(meta["requires_password"])

    def test_block_dangerous_extension(self):
        """Test that executable files are blocked."""
        with self.assertRaises(ValueError):
            create_upload_session(
                filename="trojan.exe",
                file_size=1024
            )

    def test_block_over_5gb(self):
        """Test that files over 5GB are rejected."""
        with self.assertRaises(ValueError):
            create_upload_session(
                filename="giant_archive.zip",
                file_size=MAX_HOSTING_FILE_SIZE + 1024
            )

    def test_password_protection(self):
        """Test password verification on download."""
        session = create_upload_session(
            filename="secret_notes.txt",
            file_size=2048,
            password="SecurePassword123!"
        )
        self.created_ids.append(session["file_id"])
        meta = get_file_metadata(session["file_id"])
        self.assertTrue(meta["requires_password"])

        # Try download with wrong password
        with self.assertRaises(PermissionError):
            prepare_download(session["file_id"], password="wrong")

    def test_delete_with_token(self):
        """Test instant deletion by uploader using secret token."""
        session = create_upload_session(
            filename="temp_photo.png",
            file_size=4096
        )
        file_id = session["file_id"]
        self.created_ids.append(file_id)
        token = session["delete_token"]

        # Delete with invalid token
        with self.assertRaises(PermissionError):
            delete_hosted_file(file_id, "wrong_token_123")

        # Delete with correct token
        deleted = delete_hosted_file(file_id, token)
        self.assertTrue(deleted)

        # Ensure no longer accessible
        meta = get_file_metadata(file_id)
        self.assertIsNone(meta)

    def test_burn_on_read_r2_preserves_grace_window(self):
        """Burn-on-read on R2 sets purge_after=now+1800 so cleanup does not kill an active download immediately."""
        fake_r2 = MagicMock()
        fake_r2.generate_presigned_url.return_value = "https://r2.example.invalid/presigned"
        with patch("app.services.r2_storage_service.get_r2_client", return_value=fake_r2):
            session = create_upload_session(
                filename="burn_secret.txt",
                file_size=128,
                max_downloads=1,
            )
            fid = session["file_id"]
            self.created_ids.append(fid)

            # Backdate created_at well past 60s to ensure cleanup cannot rely on created_at
            old_ts = int(time.time()) - 7200
            with get_db() as conn:
                conn.execute("UPDATE hosted_files SET created_at = ? WHERE id = ?", (old_ts, fid))

            dl = prepare_download(fid)
            self.assertEqual(dl["url"], "https://r2.example.invalid/presigned")

            cleanup_expired_files_job(force=True)
            fake_r2.delete_object.assert_not_called()

            # Advance past grace window -> now cleanup purges the R2 object
            with get_db() as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute("SELECT is_deleted, purge_after FROM hosted_files WHERE id = ?", (fid,)).fetchone()
                self.assertEqual(row["is_deleted"], 1)
                self.assertGreater(row["purge_after"], int(time.time()) + 1700)
                conn.execute("UPDATE hosted_files SET purge_after = ? WHERE id = ?", (int(time.time()) - 5, fid))

            cleanup_expired_files_job(force=True)
            fake_r2.delete_object.assert_called_once()

    def test_confirm_upload_rejects_unbacked_r2_object(self):
        """confirm_upload_session fails if object is missing in R2 head_object."""
        fake_r2 = MagicMock()
        fake_r2.generate_presigned_url.return_value = "https://r2.example.invalid/put"
        fake_r2.head_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}},
            "HeadObject",
        )
        with patch("app.services.r2_storage_service.get_r2_client", return_value=fake_r2):
            session = create_upload_session(
                filename="ghost.pdf",
                file_size=512,
                auto_confirm=False,
            )
            fid = session["file_id"]
            self.created_ids.append(fid)
            self.assertIsNone(get_file_metadata(fid))
            with self.assertRaises(ValueError):
                confirm_upload_session(fid)

    def test_http_local_upload_confirm_stream_and_guards(self):
        """End-to-end TestClient flow for local fallback: init -> upload-direct -> confirm -> stream -> replay & report 404."""
        client = TestClient(app)
        with patch("app.services.r2_storage_service.get_r2_client", return_value=None):
            # 1. Ghost confirm fails before bytes are uploaded
            init_r = client.post("/api/hosting/init-upload", json={
                "filename": "hello.txt",
                "file_size": 12,
                "content_type": "text/plain",
                "expiry_days": 1,
                "max_downloads": 0,
            })
            self.assertEqual(init_r.status_code, 200)
            fid = init_r.json()["data"]["file_id"]
            self.created_ids.append(fid)

            self.assertEqual(client.get(f"/api/hosting/info/{fid}").status_code, 404)
            self.assertEqual(client.post(f"/api/hosting/confirm-upload/{fid}").status_code, 400)

            # 2. Upload direct succeeds once, rejects replay (409)
            up_r = client.post(
                f"/api/hosting/upload-direct/{fid}",
                files={"file": ("hello.txt", b"hello world!", "text/plain")},
            )
            self.assertEqual(up_r.status_code, 200)
            replay_up = client.post(
                f"/api/hosting/upload-direct/{fid}",
                files={"file": ("hello.txt", b"overwrite!!", "text/plain")},
            )
            self.assertEqual(replay_up.status_code, 409)

            # 3. Confirm, inspect info, fetch one-time stream URL, stream & reject token replay
            self.assertEqual(client.post(f"/api/hosting/confirm-upload/{fid}").status_code, 200)
            self.assertEqual(client.get(f"/api/hosting/info/{fid}").status_code, 200)

            dl_r = client.post(f"/api/hosting/download/{fid}", json={})
            self.assertEqual(dl_r.status_code, 200)
            stream_url = dl_r.json()["download_url"]
            self.assertTrue(stream_url.startswith(f"/api/hosting/stream/{fid}?token="))

            file_resp = client.get(stream_url)
            self.assertEqual(file_resp.status_code, 200)
            self.assertEqual(file_resp.content, b"hello world!")

            # One-time token cannot be replayed
            self.assertEqual(client.get(stream_url).status_code, 404)

            # 4. Reporting non-existent file ID returns 404
            rep_404 = client.post("/api/hosting/report/NON_EXISTENT_ID_999", json={"reason": "Invalid fake target ID check"})
            self.assertEqual(rep_404.status_code, 404)

    def test_complete_multipart_client_error_and_double_confirm_guard(self):
        """Multipart completion handles R2 ClientError cleanly and blocks duplicate completion."""
        fake_r2 = MagicMock()
        fake_r2.create_multipart_upload.return_value = {"UploadId": "up_123"}
        fake_r2.generate_presigned_url.return_value = "https://r2.example.invalid/part"
        fake_r2.complete_multipart_upload.side_effect = ClientError(
            {"Error": {"Code": "InvalidPart", "Message": "Bad ETag"}},
            "CompleteMultipartUpload",
        )
        with patch("app.services.r2_storage_service.get_r2_client", return_value=fake_r2):
            session = create_upload_session(
                filename="large_archive.zip",
                file_size=70 * 1024 * 1024,
                auto_confirm=False,
                use_multipart=True,
            )
            fid = session["file_id"]
            self.created_ids.append(fid)
            self.assertEqual(session["upload_mode"], "multipart")

            with self.assertRaises(ValueError):
                complete_multipart_session(fid, "up_123", [{"PartNumber": 1, "ETag": '"bad"'}])

            # Succeed once, then reject duplicate completion
            fake_r2.complete_multipart_upload.side_effect = None
            fake_r2.head_object.return_value = {"ContentLength": 70 * 1024 * 1024}
            meta = complete_multipart_session(fid, "up_123", [{"PartNumber": 1, "ETag": '"ok"'}])
            self.assertEqual(meta["file_size"], 70 * 1024 * 1024)
            with self.assertRaises(ValueError):
                complete_multipart_session(fid, "up_123", [{"PartNumber": 1, "ETag": '"ok"'}])

    def test_abort_multipart_cannot_delete_confirmed_or_wrong_upload_id(self):
        """abort_multipart_session must refuse deleting confirmed files or mismatched upload_id."""
        fake_r2 = MagicMock()
        fake_r2.create_multipart_upload.return_value = {"UploadId": "real_up_1"}
        fake_r2.head_object.return_value = {"ContentLength": 70 * 1024 * 1024}
        client = TestClient(app)

        with patch("app.services.r2_storage_service.get_r2_client", return_value=fake_r2):
            session = create_upload_session(
                filename="protected.zip",
                file_size=70 * 1024 * 1024,
                auto_confirm=False,
                use_multipart=True,
            )
            fid = session["file_id"]
            self.created_ids.append(fid)

            # Wrong upload_id must be rejected (403) without aborting or deleting
            bad_abort = client.post(f"/api/hosting/abort-multipart/{fid}", json={"upload_id": "wrong_id"})
            self.assertEqual(bad_abort.status_code, 403)
            fake_r2.abort_multipart_upload.assert_not_called()

            # Complete upload so it becomes confirmed
            complete_multipart_session(fid, "real_up_1", [{"PartNumber": 1, "ETag": '"ok"'}])
            self.assertIsNotNone(get_file_metadata(fid))

            # Even with the real upload_id, abort after confirmation must fail (403) and keep file alive
            post_confirm_abort = client.post(f"/api/hosting/abort-multipart/{fid}", json={"upload_id": "real_up_1"})
            self.assertEqual(post_confirm_abort.status_code, 403)
            self.assertIsNotNone(get_file_metadata(fid))

    def test_delete_missing_returns_404_not_500_and_expired_commits(self):
        """DELETE missing returns 404 (not 500); expired confirm & stream token cleanup commit cleanly."""
        client = TestClient(app)
        del_404 = client.delete("/api/hosting/delete/NO_SUCH_FILE?token=abc")
        self.assertEqual(del_404.status_code, 404)

        # Malformed multipart parts should return 422 (not 500)
        bad_mp = client.post("/api/hosting/complete-multipart/NO_SUCH", json={"upload_id": "x", "parts": [{"foo": "bar"}]})
        self.assertEqual(bad_mp.status_code, 422)

        # Expired confirm_upload_session persists is_deleted=1 before raising ValueError
        with patch("app.services.r2_storage_service.get_r2_client", return_value=None):
            session = create_upload_session(filename="exp.txt", file_size=10, auto_confirm=False)
            fid = session["file_id"]
            self.created_ids.append(fid)
            with get_db() as conn:
                conn.execute("UPDATE hosted_files SET expires_at = ? WHERE id = ?", (int(time.time()) - 10, fid))
            with self.assertRaises(ValueError):
                confirm_upload_session(fid)
            with get_db() as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute("SELECT is_deleted FROM hosted_files WHERE id = ?", (fid,)).fetchone()
                self.assertEqual(row["is_deleted"], 1)

            # Expired stream token should stay deleted after raising ValueError
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO download_tokens (token, file_id, expires_at) VALUES (?, ?, ?)",
                    ("tok_exp", fid, int(time.time()) - 5),
                )
            with self.assertRaises(ValueError):
                consume_local_stream_token(fid, "tok_exp")
            with get_db() as conn:
                tok = conn.execute("SELECT 1 FROM download_tokens WHERE token = 'tok_exp'").fetchone()
                self.assertIsNone(tok)

    def test_in_progress_local_upload_confirm_guard_and_abandoned_cleanup(self):
        """confirm_upload_session rejects upload_confirmed=-1; cleanup purges stale -1 sessions >2h old."""
        with patch("app.services.r2_storage_service.get_r2_client", return_value=None):
            session = create_upload_session(filename="stuck.bin", file_size=64, auto_confirm=False)
            fid = session["file_id"]
            self.created_ids.append(fid)

            local_dir = r2_service.HOSTING_DIR / fid
            local_dir.mkdir(parents=True, exist_ok=True)
            (local_dir / "stuck.bin").write_bytes(b"partial-bytes")

            with get_db() as conn:
                conn.execute("UPDATE hosted_files SET upload_confirmed = -1 WHERE id = ?", (fid,))

            with self.assertRaises(ValueError):
                confirm_upload_session(fid)

            # Backdate created_at beyond 2 hours -> cleanup must purge local dir and set is_deleted=2
            with get_db() as conn:
                conn.execute(
                    "UPDATE hosted_files SET created_at = ? WHERE id = ?",
                    (int(time.time()) - 8000, fid),
                )

            cleanup_expired_files_job(force=True)
            self.assertFalse(local_dir.exists())
            with get_db() as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute("SELECT is_deleted FROM hosted_files WHERE id = ?", (fid,)).fetchone()
                self.assertEqual(row["is_deleted"], 2)


if __name__ == "__main__":
    unittest.main()
