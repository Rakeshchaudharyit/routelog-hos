#!/usr/bin/env bash
set -euo pipefail
python manage.py migrate --noinput
if [[ -n "${DEMO_ADMIN_EMAIL:-}" && -n "${DEMO_ADMIN_PASSWORD:-}" ]]; then
  python manage.py create_demo_user
fi
