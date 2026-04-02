#!/bin/bash
set -e

# Get the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Convert DATABASE_URL to asyncpg format for the backend
export DATABASE_URL="${DATABASE_URL/postgresql:\/\//postgresql+asyncpg://}"
export DATABASE_URL="${DATABASE_URL/postgres:\/\//postgresql+asyncpg://}"

# Install backend dependencies if not already installed
cd "$PROJECT_DIR/backend"
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "Installing backend dependencies..."
    pip3 install --break-system-packages -r requirements.txt
fi

# Install frontend dependencies if not already installed
cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start FastAPI backend on port 8000 (background)
cd "$PROJECT_DIR/backend"
python3 -m uvicorn app.main:app --host localhost --port 8000 --reload &
BACKEND_PID=$!

# Start Vite frontend on port 5000
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# Cleanup function
cleanup() {
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Wait for both
wait $BACKEND_PID $FRONTEND_PID
