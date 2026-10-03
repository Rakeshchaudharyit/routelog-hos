# M7 local validation — 2026-10-03

No HOS/fuel/route-progress algorithm was rewritten during deployment preparation.

## Automated checks

- Django `check`: no issues.
- `makemigrations --check`: no changes detected.
- Django tests: 139 passed.
- Frontend typecheck and production build: passed.
- Trip/location/map/log service and workspace/session/CSRF regression scripts: passed.
- Initial JS: local build 422.29 KB / 133.36 KB gzip; production `/api` build 422.27 KB / 133.35 KB gzip, no bundle warning; map/settings/full-log lazy chunks retained.
- Production PostgreSQL settings: validated with a nonconnecting placeholder URL. Actual PostgreSQL connectivity/migrations require the Render database.
- `check --deploy`: two intentional HSTS subdomain/preload warnings, documented in deployment instructions.
- WhiteNoise collectstatic: completed; local admin login and admin CSS return HTTP 200.
- Vercel config imports and API/media rewrite assertions: passed; shell scripts parse successfully. Hosting integration remains unverified until deployment.

## Live OSRM routes

All three requests used real selected coordinates and cycle inputs; OSRM returned full route geometry. All compliance checks passed; events are chronological, calculated stop coordinates are finite/in range, and every log covers exactly 86,400 seconds. Daily miles sum to route distance. Raw evidence is kept locally under ignored `outputs/production-readiness/`.

| Case | Distance | Driving | Elapsed | Fuel | Daily rests | Logs | Cycle end / remaining |
|---|---:|---:|---:|---:|---:|---:|---:|
| Atlanta → Nashville → Dallas, cycle 18 | 911.8649 mi | 16h 21m 35s | 28h 21m 35s | 0 | 1 | 2 | 36.3597 / 33.6403 h |
| New York → Atlanta → Dallas, cycle 18 | 1662.0048 mi | 31h 04m 43s | 54h 34m 42s | 1 | 2 | 3 | 51.5783 / 18.4217 h |
| Atlanta → Nashville → Dallas, cycle 65 | 911.8649 mi | 16h 21m 35s | 62h 51m 35s | 0 | 1 | 3 | 13.6872 / 56.3128 h |

New York fuel: Oct 6 12:36:28–13:06:28, exactly 30 minutes ON DUTY, route mile 999.9877, coordinates 33.5958286 / -86.3958025. It adds 0.5 cycle hours, qualifies as a break, and has no duplicate break at its start. Its dated fuel remark appears only on the second log. Total cycle consumption is 33.5783 hours (driving, pickup/dropoff and fuel).

Cycle-65 restart: Oct 5 10:40:21–Oct 6 20:40:21, exactly 34 hours OFF DUTY at mile 246.8935. Cycle resets to zero; maximum observed cycle is 69.6725 hours, below 70. Restart is represented across midnight in daily logs, with a dated starting remark.

## Browser and print

Final browser verification covers real route maps, timeline/log tabs, fuel and restart markers, full-log lazy rendering and settings lazy loading. Console error/warning checks are clean. The full-log portal is a direct BODY child, contains SVG duty paths, and the browser has the intended print media rules loaded. Native Chrome print-preview automation is blocked by macOS permissions and remains **Manual verification required**. Print CSS targets the body-portaled log, hides application UI/controls, removes scroll clipping and retains the graph/metadata/remarks. Follow README's exact manual preview steps; no physical/native-print result is claimed.

Public-host integration, production PostgreSQL migrations, final native print preview and Loom recording are intentionally pending account access/deployment.
