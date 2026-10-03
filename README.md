# RouteLog HOS

RouteLog plans Current → Pickup → Dropoff trips using real OSRM routes, calculates a property-carrying HOS schedule, and displays chronological stops, a Leaflet map and daily planning logs. The React interface includes Django session login and persistent administrator profile/branding settings.

## Stack and architecture

React 19, TypeScript, Vite, Framer Motion and React Leaflet form the frontend. Django 5.2/DRF owns validation, authentication, settings, routing, scheduling and daily-log generation. SQLite is used locally; production requires PostgreSQL. WhiteNoise serves collected Django static assets.

`frontend/src/services/` adapts the API into UI types. `backend/trips/services/` contains OSRM/Nominatim adapters, the deterministic HOS scheduler, geometry interpolation and daily-log generation. `backend/accounts/` provides sessions, profile, branding and logo validation. Calculated timeline, map markers and log remarks all derive from the same backend events.

## Local setup

Use Python 3.12 and Node.js 20+.

```sh
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-lock.txt
cp .env.example .env
python -c 'import secrets; print(secrets.token_urlsafe(50))'
```

Put the generated key in the ignored `backend/.env`; keep `DJANGO_DEBUG=true` and `DATABASE_URL` empty locally.

```sh
python manage.py migrate
python manage.py create_demo_user
python manage.py runserver
```

The bootstrap command prompts privately for credentials and leaves an existing account unchanged. For this assessment, use `chaudharyrakeshit@gmail.com` / `Rakesh@123`. These are demo credentials, never production account credentials; no password is embedded in React or API views.

In a second terminal:

```sh
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`. Use localhost consistently for frontend and backend. Backend health: `http://localhost:8000/api/health/`. Restart servers after changing environment files.

## HOS assumptions and logs

The schedule implements 11 driving hours after a 10-hour rest, a fixed 14-hour driving window, a qualifying 30-minute non-driving period before exceeding eight driving hours, and a simplified 70-hour cycle with a 34-hour restart when required. Pickup/dropoff each take one hour. Fuel is scheduled before further travel beyond a 1,000-mile interval: 30 minutes ON DUTY, consuming cycle time and qualifying as a break without a duplicate break. Whole-second scheduling can place fuel slightly before the distance boundary.

All calculations use integer seconds and the backend's deterministic planning clock, without browser timezone conversion. Daily logs split at midnight and each cover exactly 24 hours. They include metadata, miles, duty graph/totals and dated remarks, and always remain **Planned Log — Driver Certification Required**. Route stop coordinates are interpolated on the real route; they are approximate planning positions, not verified fuel stations or safe parking.

OSRM's driving profile does not model truck restrictions, traffic or weather. Public Nominatim uses explicit Search/Enter, not autocomplete; requests are spaced and cached for a single-process assessment server. Map attribution is retained. No Google Maps or paid mapping APIs are used.

Deferred: rolling eight-day recapture, split sleeper/adverse-condition exceptions, facility discovery, certified ELD/hardware/signatures/filing, manual duty editing, PDF export, password recovery/OAuth/2FA and multi-tenant administration. Logo files on Render's ephemeral filesystem may disappear on redeploy; no cloud storage is introduced.

## Validation

```sh
cd backend
source .venv/bin/activate
python manage.py check
python manage.py makemigrations --check
python manage.py test
```

```sh
cd frontend
npm run typecheck
npm run build
node scripts/verify-trips.mjs
node scripts/verify-workspace.mjs
```

The final local M7 run passes **139 backend tests**, frontend typecheck/build and both service regressions. The initial JS bundle is **422.27 KB (133.35 KB gzip)** for the production `/api` build; map, settings and full-log code load separately. There is no bundle-size warning. External services are mocked in automated tests; three separate live OSRM regressions are recorded in [validation](docs/validation.md).

Native Chrome print preview requires manual verification. Open **View Full Log → Print Log**, select landscape, and verify the complete graph, driver/carrier/vehicle/shipping metadata, daily miles, totals summing to 24.00, dated remarks and driver-certification-required status. Confirm sidebar, application header, modal toolbar and buttons are hidden, with no graph clipping or missing remarks. Repeat for the long route's fuel day and a restart day. Print CSS and screen-rendered log structure have been inspected; native preview is not certified as checked.

## Deployment preparation

Target repository: `routelog-hos`. Frontend: Vercel. Backend: Render. Database: Render PostgreSQL. Deployment is prepared locally and has **not** been performed. See [deployment instructions](docs/deployment.md), [commit checklist](docs/commit-checklist.md) and [demo script](docs/demo-script.md).

The production request path is browser → Vercel `/api/*` → Render Django → PostgreSQL. `/media/*` is also proxied. A relative `/api` frontend base keeps requests first-party. Django sessions stay HttpOnly/Secure/SameSite=Lax; CSRF tokens are bootstrapped in memory, rotate on login and accompany mutations. Exact HTTPS frontend origins are trusted; CORS is never wildcard and CSRF remains enabled. API responses are private/no-store. Public-host cookie/CSRF verification remains part of deployment acceptance.
