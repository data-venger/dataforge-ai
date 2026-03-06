#!/bin/bash

# =================================================================
# DataForge.ai — Quick Start Script
# Runs both the Python AI Engine and the Electron Application
# =================================================================

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}       Starting DataForge.ai ⚡️        ${NC}"
echo -e "${BLUE}=======================================${NC}"

# 1. Check if Ollama is running
echo -e "\n${GREEN}[1/3] Checking Ollama status...${NC}"
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo -e "${RED}Error: Ollama is not running.${NC}"
    echo "Please start the Ollama application before running DataForge."
    exit 1
fi
echo "Ollama is running!"

# 2. Setup and Start the Python AI Engine (in the background)
echo -e "\n${GREEN}[2/3] Starting Python Inference Engine...${NC}"
cd python-engine

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate environment and install requirements
echo "Activating virtual environment and ensuring dependencies are installed..."
source venv/bin/activate
pip install -r requirements.txt -q

# Start FastAPI server in the background
echo "Starting FastAPI server on port 8000..."
uvicorn main:app --port 8000 --reload &
PYTHON_PID=$!

# Wait a few seconds to let FastAPI spin up
sleep 3

# Return to project root
cd ..

# 3. Start the Electron/React App
echo -e "\n${GREEN}[3/3] Starting Electron Application...${NC}"
npm install --silent
npm run dev

# When the user closes the Electron app (npm run dev exits),
# we need to make sure we kill the Python server running in the background.
echo -e "\n${BLUE}Shutting down Python server (PID: $PYTHON_PID)...${NC}"
kill $PYTHON_PID
wait $PYTHON_PID 2>/dev/null

echo -e "${GREEN}DataForge.ai closed safely.${NC}"
