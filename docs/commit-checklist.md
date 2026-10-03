# First commit checklist

Git is intentionally uninitialized. No repository, commit or push has been created.

Commit exactly these project assets:

- Root: `.gitignore`, `README.md`, `render.yaml`, `docs/`.
- Backend: `.env.example`, `manage.py`, `requirements.txt`, `requirements-lock.txt`, `build.sh`, `release.sh`, `start.sh`; all Python source/tests in `config/`, `core/`, `accounts/` (including migrations/management command) and `trips/`.
- Frontend: `.env.example`, `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `vercel.mjs`, all `src/`, any project `public/` assets, and `scripts/` regression checks/fixtures.

Exclude local `.env`/`.env.local`, secrets, `.venv`, SQLite databases, uploads/media, node_modules, dist, staticfiles, tsbuildinfo, logs, caches, outputs/screenshots/live responses, temporary work and deployment state. `.gitignore` covers these. `backend/package-lock.json` is an empty npm artifact unrelated to the Python backend: exclude it.

After authorization to publish: initialize Git, stage only the listed assets, inspect `git diff --cached` and staged filenames for credentials/generated artifacts, then create the first commit and push to the requested repository. Retain local evidence in ignored outputs; do not delete it as cleanup.
