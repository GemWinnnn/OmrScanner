"""
Supabase client service.
Handles DB operations and auth token validation.
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def get_supabase_client():
    """Get a Supabase client using the service role key (server-side)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        from supabase import create_client

        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        return None


def get_user_from_token(token: str) -> dict | None:
    """Validate a Supabase JWT and return user info."""
    client = get_supabase_client()
    if not client:
        return None
    try:
        user_response = client.auth.get_user(token)
        if user_response and user_response.user:
            return {
                "id": user_response.user.id,
                "email": user_response.user.email,
            }
    except Exception:
        pass
    return None


# ─── Database helpers ──────────────────────────────────────────────

def db_insert(table: str, data: dict) -> dict | None:
    """Insert a row and return it."""
    client = get_supabase_client()
    if not client:
        return None
    try:
        result = client.table(table).insert(data).execute()
        if result.data:
            return result.data[0]
    except Exception:
        pass
    return None


def db_select(table: str, filters: dict | None = None, limit: int = 100) -> list[dict]:
    """Select rows with optional filters."""
    client = get_supabase_client()
    if not client:
        return []
    try:
        query = client.table(table).select("*").limit(limit)
        if filters:
            for k, v in filters.items():
                query = query.eq(k, v)
        result = query.order("created_at", desc=True).execute()
        return result.data or []
    except Exception:
        return []


def db_select_one(table: str, id: str) -> dict | None:
    """Select a single row by id."""
    client = get_supabase_client()
    if not client:
        return None
    try:
        result = client.table(table).select("*").eq("id", id).single().execute()
        return result.data
    except Exception:
        return None


def db_update(table: str, id: str, data: dict) -> dict | None:
    """Update a row by id."""
    client = get_supabase_client()
    if not client:
        return None
    try:
        result = client.table(table).update(data).eq("id", id).execute()
        if result.data:
            return result.data[0]
    except Exception:
        pass
    return None


def db_delete(table: str, id: str) -> bool:
    """Delete a row by id."""
    client = get_supabase_client()
    if not client:
        return False
    try:
        client.table(table).delete().eq("id", id).execute()
        return True
    except Exception:
        return False
