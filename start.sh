#!/bin/bash
set -e

echo "building react app..."
cd client
npm install
npm run build
cd ..

echo "starting flask server..."
cd server
gunicorn app:app --bind 0.0.0.0:8888 --workers 2
