# OMR Scanner Web App

A full-stack web application for scanning Optical Mark Recognition (OMR) answer sheets. Upload a scanned image or use your camera to detect marked bubbles and score against an answer key.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI + OpenCV
- **Database & Auth**: Supabase
- **Hosting**: Render

## Quick Start

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### 3. Supabase (Optional)

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase_setup.sql` in the SQL Editor
3. Copy your project URL and keys into `backend/.env` and `frontend/.env`

The app works fully without Supabase (uses in-memory storage).

## Features

- **Scan Page**: Upload images or use camera to scan OMR sheets
- **Answer Key Editor**: Interactive bubble grid for 100 questions (A-E), import/export CSV
- **Results**: View scan history with scores and export to CSV
- **Templates**: Manage OMR sheet templates (default: 100-question MCQ5)

## API Docs

With the backend running, visit **http://localhost:8000/docs** for interactive Swagger documentation.
