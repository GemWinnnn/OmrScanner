"""
Answer Key CRUD API endpoints.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user, get_optional_user
from app.models.schemas import AnswerKeyCreate, AnswerKeyResponse
from app.services.supabase_client import db_delete, db_insert, db_select, db_select_one, db_update

router = APIRouter(prefix="/api/answer-keys", tags=["answer-keys"])

# In-memory store as fallback when Supabase is not configured
_local_answer_keys: dict[str, dict] = {}


def _row_to_response(r: dict) -> AnswerKeyResponse:
    answers = r.get("answers_json", r.get("answers", {}))
    if isinstance(answers, str):
        answers = json.loads(answers)
    ms = r.get("marking_scheme_json", r.get("marking_scheme", {}))
    if isinstance(ms, str):
        ms = json.loads(ms)
    return AnswerKeyResponse(
        id=r["id"],
        name=r["name"],
        template_id=r.get("template_id"),
        class_id=r.get("class_id"),
        answers=answers,
        marking_scheme=ms,
        total_items=r.get("total_items"),
        user_id=r.get("user_id"),
        created_at=r.get("created_at"),
    )


@router.get("", response_model=list[AnswerKeyResponse])
async def list_answer_keys(
    class_id: str | None = None,
    user: dict | None = Depends(get_optional_user),
):
    """List all answer keys, optionally filtered by class_id."""
    filters: dict | None = None
    if class_id:
        filters = {"class_id": class_id}
    if user:
        filters = filters or {}
        filters["user_id"] = user["id"]

    rows = db_select("answer_keys", filters=filters)
    if rows:
        return [_row_to_response(r) for r in rows]

    # Fallback to local
    local = list(_local_answer_keys.values())
    if class_id:
        local = [ak for ak in local if ak.get("class_id") == class_id]
    return [AnswerKeyResponse(**ak) for ak in local]


@router.get("/{key_id}", response_model=AnswerKeyResponse)
async def get_answer_key(key_id: str):
    """Get a single answer key by ID."""
    if key_id in _local_answer_keys:
        return AnswerKeyResponse(**_local_answer_keys[key_id])

    row = db_select_one("answer_keys", key_id)
    if row:
        return _row_to_response(row)
    raise HTTPException(status_code=404, detail="Answer key not found")


@router.post("", response_model=AnswerKeyResponse)
async def create_answer_key(
    body: AnswerKeyCreate,
    user: dict | None = Depends(get_optional_user),
):
    """Create a new answer key."""
    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    ms_dict = body.marking_scheme.model_dump()
    user_id = user["id"] if user else None

    data = {
        "id": new_id,
        "name": body.name,
        "template_id": body.template_id,
        "class_id": body.class_id,
        "answers": body.answers,
        "marking_scheme": ms_dict,
        "total_items": body.total_items,
        "user_id": user_id,
        "created_at": now,
    }

    # Try Supabase
    row = db_insert("answer_keys", {
        "id": new_id,
        "name": body.name,
        "template_id": body.template_id,
        "class_id": body.class_id,
        "answers_json": json.dumps(body.answers),
        "marking_scheme_json": json.dumps(ms_dict),
        "total_items": body.total_items,
        "user_id": user_id,
        "created_at": now,
    })

    if not row:
        # Fallback to local
        _local_answer_keys[new_id] = data

    return AnswerKeyResponse(**data)


@router.put("/{key_id}", response_model=AnswerKeyResponse)
async def update_answer_key(
    key_id: str,
    body: AnswerKeyCreate,
    user: dict | None = Depends(get_optional_user),
):
    """Update an existing answer key."""
    ms_dict = body.marking_scheme.model_dump()
    user_id = user["id"] if user else None

    # Try Supabase first
    update_data = {
        "name": body.name,
        "template_id": body.template_id,
        "class_id": body.class_id,
        "answers_json": json.dumps(body.answers),
        "marking_scheme_json": json.dumps(ms_dict),
        "total_items": body.total_items,
    }
    row = db_update("answer_keys", key_id, update_data)
    if row:
        return _row_to_response(row)

    if key_id in _local_answer_keys:
        _local_answer_keys[key_id].update({
            "name": body.name,
            "template_id": body.template_id,
            "class_id": body.class_id,
            "answers": body.answers,
            "marking_scheme": ms_dict,
            "total_items": body.total_items,
        })
        return AnswerKeyResponse(**_local_answer_keys[key_id])

    raise HTTPException(status_code=404, detail="Answer key not found")


@router.delete("/{key_id}")
async def delete_answer_key(key_id: str):
    """Delete an answer key."""
    if key_id in _local_answer_keys:
        del _local_answer_keys[key_id]
        return {"message": "Deleted"}

    if db_delete("answer_keys", key_id):
        return {"message": "Deleted"}

    raise HTTPException(status_code=404, detail="Answer key not found")
