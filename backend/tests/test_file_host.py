import os
import sys
import unittest
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.r2_storage_service import (
    create_upload_session,
    get_file_metadata,
    prepare_download,
    delete_hosted_file,
    MAX_HOSTING_FILE_SIZE
)

class TestFileHosting(unittest.TestCase):
    def test_create_session_success(self):
        """Test initializing an anonymous upload session with default 24-hour (1-day) expiration."""
        session = create_upload_session(
            filename="my_document.pdf",
            file_size=1024 * 500,  # 500KB
        )
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

if __name__ == "__main__":
    unittest.main()
