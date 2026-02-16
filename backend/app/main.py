"""
FastAPI application entry point for the OMR Scanner backend.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import answer_keys, classes, results, scan, templates

load_dotenv()

app = FastAPI(
    title="OMR Scanner API",
    description="Web-based Optical Mark Recognition scanner API",
    version="1.0.0",
)

# CORS - allow frontend dev server
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(scan.router)
app.include_router(templates.router)
app.include_router(answer_keys.router)
app.include_router(results.router)
app.include_router(classes.router)


@app.get("/")
async def root():
    return {
        "message": "OMR Scanner API is running",
        "docs": "/docs",
        "version": "1.0.0",
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
