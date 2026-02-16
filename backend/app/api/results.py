"""
Scan Results API endpoints.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_optional_user
from app.models.schemas import ScanResultDB
from app.services.supabase_client import db_delete, db_insert, db_select, db_select_one

router = APIRouter(prefix="/api/results", tags=["results"])

# In-memory store as fallback
_local_results: dict[str, dict] = {}


def _row_to_result(r: dict) -> ScanResultDB:
    answers = r.get("detected_answers_json", r.get("detected_answers", {}))
    if isinstance(answers, str):
        answers = json.loads(answers)
    return ScanResultDB(
        id=r["id"],
        template_id=r.get("template_id"),
        answer_key_id=r.get("answer_key_id"),
        class_id=r.get("class_id"),
        student_name=r.get("student_name"),
        image_url=r.get("image_url"),
        detected_answers=answers,
        score=r.get("score"),
        total=r.get("total"),
        user_id=r.get("user_id"),
        created_at=r.get("created_at"),
    )


@router.get("", response_model=list[ScanResultDB])
async def list_results(
    class_id: str | None = None,
    user: dict | None = Depends(get_optional_user),
):
    """List all scan results, optionally filtered by class_id."""
    filters: dict | None = None
    if class_id:
        filters = {"class_id": class_id}
    if user:
        filters = filters or {}
        filters["user_id"] = user["id"]

    rows = db_select("scan_results", filters=filters)
    if rows:
        return [_row_to_result(r) for r in rows]

    # Fallback to local
    local = list(_local_results.values())
    if class_id:
        local = [r for r in local if r.get("class_id") == class_id]
    return [ScanResultDB(**r) for r in local]


@router.get("/{result_id}", response_model=ScanResultDB)
async def get_result(result_id: str):
    """Get a single scan result."""
    if result_id in _local_results:
        return ScanResultDB(**_local_results[result_id])

    row = db_select_one("scan_results", result_id)
    if row:
        return _row_to_result(row)
    raise HTTPException(status_code=404, detail="Result not found")


@router.delete("/{result_id}")
async def delete_result(result_id: str):
    """Delete a scan result."""
    if result_id in _local_results:
        del _local_results[result_id]
        return {"message": "Deleted"}

    if db_delete("scan_results", result_id):
        return {"message": "Deleted"}

    raise HTTPException(status_code=404, detail="Result not found")


def save_result(
    detected_answers: dict[str, str],
    score: float | None = None,
    total: int | None = None,
    template_id: str | None = None,
    answer_key_id: str | None = None,
    student_name: str | None = None,
    class_id: str | None = None,
    user_id: str | None = None,
) -> str:
    """Save a scan result and return its ID."""
    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    data = {
        "id": new_id,
        "template_id": template_id,
        "answer_key_id": answer_key_id,
        "class_id": class_id,
        "student_name": student_name,
        "image_url": None,
        "detected_answers": detected_answers,
        "score": score,
        "total": total,
        "user_id": user_id,
        "created_at": now,
    }

    # Try Supabase
    row = db_insert("scan_results", {
        "id": new_id,
        "template_id": template_id,
        "answer_key_id": answer_key_id,
        "class_id": class_id,
        "student_name": student_name,
        "detected_answers_json": json.dumps(detected_answers),
        "score": score,
        "total": total,
        "user_id": user_id,
        "created_at": now,
    })

    if not row:
        _local_results[new_id] = data

    return new_id
