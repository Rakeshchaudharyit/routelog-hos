#!/usr/bin/env bash
set -euo pipefail
python -m pip install -r requirements-lock.txt
python manage.py collectstatic --noinput
