#!/bin/bash
set -e

# Convert DATABASE_URL to asyncpg format for the backend
export DATABASE_URL="${DATABASE_URL/postgresql:\/\//postgresql+asyncpg://}"
export DATABASE_URL="${DATABASE_URL/postgres:\/\//postgresql+asyncpg://}"

# Start FastAPI backend on port 8000 (background)
cd /home/runner/workspace/backend
python -m uvicorn app.main:app --host localhost --port 8000 --reload &
BACKEND_PID=$!

# Start Vite frontend on port 5000
cd /home/runner/workspace/frontend
npm run dev &
FRONTEND_PID=$!

# Wait for both
wait $BACKEND_PID $FRONTEND_PID
