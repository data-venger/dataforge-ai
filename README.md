# DataForge.ai ⚡️

A local-first AI data workspace. All data stays on your machine. No cloud APIs, no data leaks.

## Architecture

DataForge is a hybrid application combining web technologies, embedded databases, and local machine learning:

1. **Frontend (Electron + React + Vite):** A responsive, premium dark-themed UI.
2. **Data Layer (DuckDB-WASM):** Local, in-memory analytical database running directly in the renderer process. Fast CSV, JSON, and Parquet imports.
3. **AI Inference Layer (Python + FastAPI):** A local sidecar managing LangChain orchestration, ChromaDB vector storage, and Ollama integration.

## Prerequisites

- **Node.js** v18+
- **Python** 3.10+
- **Ollama** (Running locally on `http://localhost:11434`)
  - Pull the model: `ollama run llama3.2`

## Setup Instructions

### 1. Python Environment

The Python backend powers the AI inference engine.

```bash
cd python-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Electron Application

The Electron app automatically manages the lifecycle of the Python sidecar.

```bash
# Return to the project root
cd ..

# Install dependencies
npm install

# Start the application
npm run dev
```

### 3. Packaging for Production (Windows / Mac)

DataForge AI uses `electron-builder` to package the application and the Python inference engine into a single executable.

```bash
# To build a `.dmg` installer for Mac
npm run build:mac

# To build a `.exe` installer for Windows
npm run build:win
```

The compiled binaries will be available in the `release/` directory.

## Features Complete Unlocked

- **Phase 1:** Electron app shell, frameless window, React navigation routing.
- **Phase 2:** DuckDB integration, File Import Pipeline (CSV/Parquet), Data Explorer UI.
- **Phase 3:** Python sidecar (FastAPI), Ollama LLM connection, ChromaDB vector indexing.
- **Phase 4:** Hybrid RAG pipeline (SQL generation + vector contextual search), Chat Sidebar UI.
- **Phase 5:** Self-correcting SQL auto-loop, strict table hallucination constraints.
- **Phase 6:** Global UI Error Boundaries, React `useMemo` rendering optimizations, and dynamic port finding for cross-platform `.dmg`/`.exe` bundling.
