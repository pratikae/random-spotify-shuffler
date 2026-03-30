#!/bin/bash
set -e

echo "starting flask server..."
cd server
gunicorn app:app --bind 0.0.0.0:8888 --workers 2 --preload
