#!/usr/bin/env bash
set -euo pipefail
exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers 1 --threads 4 --timeout 60 --access-logfile - --error-logfile -
