# Deploying Tulusy (`tulusy.cc`) on Hetzner with ServerAvatar

## 1. DNS Setup (`tulusy.cc`)
Point your DNS records at your Hetzner VPS IP:
- `A` `@` -> `<Hetzner IPv4>`
- `A` `www` -> `<Hetzner IPv4>`

> **Cloudflare Proxy Note:** If you enable Cloudflare Orange Cloud (proxied), Cloudflare Free/Pro enforces a **100 MB decimal** (`100,000,000` bytes) HTTP upload limit. Set `MAX_FILE_SIZE_MB=95` in `backend/.env` if proxied, or use DNS-only (Grey Cloud) for full 100 MiB converter uploads. 5 GB File Share uploads go directly from the browser to Cloudflare R2 and are unaffected.

---

## 2. Cloudflare R2 Bucket CORS & Lifecycle Rules (Required for 5 GB File Share)
In **Cloudflare Dashboard -> R2 -> Bucket (`tulusy`) -> Settings -> CORS Policy**, paste the contents of `deploy/r2-cors.json`:
- Allows `PUT`, `GET`, `HEAD` from `https://tulusy.cc` and `https://www.tulusy.cc`
- Allows `Content-Type` header for presigned browser uploads

> **Important Lifecycle Setting:** Under **Object Lifecycle Rules**, do **NOT** enable "Delete uploaded objects after" with a fixed age (e.g. 7 days). That would delete active Forever files regardless of views. Only "Abort incomplete multipart uploads after 7 days" should be enabled. The Tulusy backend automatically handles object deletion upon expiration or 7-day inactivity.

---

## 3. Create the Node.js Application in ServerAvatar (Frontend)
1. In ServerAvatar, select your Hetzner server (**Nginx + Node.js / PM2 stack**) and click **Applications -> Create Application**.
2. Set:
   - **Domain**: `tulusy.cc` (and add `www.tulusy.cc` as alias/redirect if desired)
   - **Deployment**: Git -> GitHub -> `Ridoyd2/tulusy.cc` (`main` branch)
   - **Process Manager**: PM2
   - **Port**: `3480`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Add environment variables inside `frontend/.env.production` (or ServerAvatar's Node environment settings):
   ```env
   NEXT_PUBLIC_SITE_URL=https://tulusy.cc
   BACKEND_URL=http://127.0.0.1:8480
   NEXT_PUBLIC_API_URL=
   ```
4. Enable **Let's Encrypt SSL** in ServerAvatar (`tulusy.cc` + `www.tulusy.cc`).

---

## 4. Install the FastAPI Backend via SSH (`systemd`)
SSH into your Hetzner VPS and run the setup script from the directory where ServerAvatar cloned the repo (typically `/home/<app_user>/apps/<app_name>` or `/home/<app_user>/<app_name>`; `setup-backend.sh` auto-detects `APP_ROOT` relative to `deploy/`):

```bash
cd /path/to/repo && sudo bash deploy/setup-backend.sh
```

Then edit `backend/.env` on the server:
```bash
nano /path/to/repo/backend/.env
```
Fill in your `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME=tulusy`, and restart:
```bash
sudo systemctl restart tulusy-backend
curl -s http://127.0.0.1:8480/api/health
```

---

## 5. Route `/api/*` Directly to FastAPI in ServerAvatar Nginx
In ServerAvatar -> Application (`tulusy.cc`) -> **Nginx Settings / Custom Configuration**, add the rules from `deploy/nginx-serveravatar-api.conf` inside the `server` block so `/api/*` bypasses Next.js and streams up to 110 MB directly to `127.0.0.1:8480` with 300s timeouts and real `X-Real-IP` / `X-Forwarded-For` headers.

Test and reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Optional: Hide Hetzner Origin IP for DA Checker & Edge Load Tester
1. Deploy `cloudflare-worker-relay.js` as a free Cloudflare Worker.
2. Add a `RELAY_SECRET` environment variable in Cloudflare Worker Settings.
3. Set `CF_WORKER_RELAY_URL` and `CF_WORKER_SECRET` in `backend/.env` and restart `tulusy-backend`.

---

## 7. Post-Deployment Smoke Checks
- `https://tulusy.cc/api/health` returns `"status": "online"`
- `https://tulusy.cc/sitemap.xml` and `https://tulusy.cc/robots.txt` reference `https://tulusy.cc`
- PNG -> WebP, SVG -> PNG, and PDF -> DOCX conversions succeed
- 5 GB File Share initializes an R2 presigned upload, completes upload, and loads `/f/<id>`
- `https://tulusy.cc` is blocked when entered in Load Tester and Domain Audit
