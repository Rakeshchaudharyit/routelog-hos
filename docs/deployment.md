# Deployment preparation: Vercel + Render PostgreSQL

Nothing has been deployed, and no repository or hosting resources have been created.

## Request architecture

Vercel serves the React build and forwards `/api/*` and `/media/*` to Render. Set frontend `VITE_API_BASE_URL=/api` and `BACKEND_ORIGIN=https://YOUR-API.onrender.com`. The latter is a plain HTTPS origin, not a secret. `frontend/vercel.mjs` exports Vercel configuration with dynamic external rewrites plus SPA routes for login, planner and settings. Vercel project root is `frontend`; install `npm ci`, build `npm run build`, output `dist`. Do not set a direct Render API URL in production React: that changes browser cookie origin semantics.

Django sees the Vercel browser Origin on mutations; configure its exact HTTPS origin in CSRF/CORS settings. Requests include credentials and X-CSRFToken; no cookie Domain is set. Check cookie forwarding and session/CSRF behavior on the real hosts before acceptance. Do not cache API responses.

## Render configuration

Create PostgreSQL in the same Render region and set its internal connection URL as `DATABASE_URL`. PostgreSQL driver and URL parsing are installed; production requires PostgreSQL with SSL. Local production checks validate settings only: no Render database connection or production migration has been tested yet.

`render.yaml` prepares a Python web service with root `backend`:

- Build: `bash build.sh` installs `requirements-lock.txt` and runs `collectstatic --noinput`.
- Pre-deploy: `bash release.sh` runs `migrate --noinput`, then idempotent demo bootstrap if both bootstrap variables are provided.
- Start: `bash start.sh` runs Gunicorn, one worker/four threads, listening on Render's `PORT`. It never runs migrations from web startup.
- Health: `/api/health/` (liveness, not a database probe).

The Blueprint uses **starter**, because Render pre-deploy commands require a paid service. Review service/database plan availability and cost before creating anything. For a free web service, remove the unsupported pre-deploy configuration and explicitly execute `python manage.py migrate --noinput` plus demo bootstrap in an authorized release workflow before starting/accepting the service. Do not omit migrations or silently add them to every process startup. Keep one worker while using the in-memory public Nominatim limiter.

## Environment variables

Backend production values (set in Render, never commit real values):

| Variable | Value/purpose |
|---|---|
| DJANGO_SECRET_KEY | Random secret of at least 50 characters; stable across releases |
| DJANGO_DEBUG | `false` |
| DJANGO_ALLOWED_HOSTS | Exact Render API hostname, plus any configured API custom hostname; comma-separated, no scheme/wildcard |
| FRONTEND_URL | Exact `https://YOUR-FRONTEND.vercel.app` |
| CSRF_TRUSTED_ORIGINS | Same exact HTTPS frontend origin; comma-separated if more than one authorized host |
| CORS_ALLOWED_ORIGINS | Same exact HTTPS frontend origin; no wildcard |
| DATABASE_URL | Render PostgreSQL internal connection URL |
| DJANGO_SERVE_DEMO_MEDIA | `true` for assessment logo serving |
| DJANGO_MEDIA_ROOT | Optional mounted path; default local `backend/media` |
| DJANGO_HSTS_SECONDS | `31536000` |
| DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD | Private bootstrap values; remove password after successful creation |
| OSRM_BASE_URL | Default public OSRM endpoint; optionally self-hosted |
| NOMINATIM_URL / NOMINATIM_USER_AGENT | Default public search endpoint and identifying User-Agent |

Use a stable Vercel production hostname. Preview domains are not automatically trusted: configure explicit approved origins if preview API access is needed. `VITE_*` values are public and must never contain secrets. Do not copy local `.env` files to GitHub.

Secure cookies, HTTPS redirection, trusted proxy protocol and one-year HSTS are enabled. Django `check --deploy` leaves two intentional warnings: HSTS subdomain coverage/preload are false because ownership of all subdomains is not established. Do not enable either casually on shared platform domains.

WhiteNoise uses compressed manifest static storage. Local collectstatic and admin CSS requests were verified. It serves static assets, not uploads. Demo `/media` serving is explicitly enabled separately; Render's default filesystem is ephemeral, so uploaded logos can vanish after deployment/restart. SQLite is local only; users/settings/sessions persist in PostgreSQL after deployment. Durable uploads remain deferred.

## Actions requiring account access

1. Review the commit checklist, initialize Git and create/push GitHub `routelog-hos` when authorized.
2. Connect Render to the repository, review billing plans, create PostgreSQL/web service and enter private production environment variables.
3. Connect Vercel to the repository, set project root/environment and deploy; put the actual Vercel origin in Render's exact trust lists.
4. Run the release step, inspect logs and health, and verify database migrations/admin static assets.
5. In a clean browser session verify login/refresh/logout, CSRF rejection without a token, password/session behavior, settings/profile persistence, logo limitation, three routes, map/timeline/log consistency and clean console. Repeat production deep links. Verify Secure/HttpOnly session cookie attributes and same-origin API/media forwarding.
6. Complete native print preview manually, capture final public URLs, then record the prepared Loom demonstration. No Loom has been recorded locally.

References: [Vercel programmatic configuration](https://vercel.com/docs/project-configuration/vercel-ts), [Vercel external rewrites](https://vercel.com/docs/routing/rewrites), [Render Django deployment](https://render.com/docs/deploy-django), [Render deployment lifecycle](https://render.com/docs/deploys), [Render filesystem persistence](https://render.com/docs/disks).
