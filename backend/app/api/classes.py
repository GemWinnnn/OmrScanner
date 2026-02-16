"""
Class CRUD API endpoints.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user, get_optional_user
from app.models.schemas import ClassCreate, ClassResponse
from app.services.supabase_client import db_delete, db_insert, db_select, db_select_one, db_update

router = APIRouter(prefix="/api/classes", tags=["classes"])

# In-memory fallback
_local_classes: dict[str, dict] = {}


@router.get("", response_model=list[ClassResponse])
async def list_classes(user: dict | None = Depends(get_optional_user)):
    """List all classes for the current user."""
    filters: dict | None = None
    if user:
        filters = {"user_id": user["id"]}

    rows = db_select("classes", filters=filters)
    if rows:
        return [
            ClassResponse(
                id=r["id"],
                name=r["name"],
                section=r.get("section"),
                subject=r.get("subject"),
                total_items=r.get("total_items", 100),
                user_id=r.get("user_id"),
                created_at=r.get("created_at"),
            )
            for r in rows
        ]

    # Fallback to local
    local = list(_local_classes.values())
    if user:
        local = [c for c in local if c.get("user_id") == user["id"]]
    return [ClassResponse(**c) for c in local]


@router.get("/{class_id}", response_model=ClassResponse)
async def get_class(class_id: str):
    """Get a single class by ID."""
    if class_id in _local_classes:
        return ClassResponse(**_local_classes[class_id])

    row = db_select_one("classes", class_id)
    if row:
        return ClassResponse(
            id=row["id"],
            name=row["name"],
            section=row.get("section"),
            subject=row.get("subject"),
            total_items=row.get("total_items", 100),
            user_id=row.get("user_id"),
            created_at=row.get("created_at"),
        )
    raise HTTPException(status_code=404, detail="Class not found")


@router.post("", response_model=ClassResponse)
async def create_class(
    body: ClassCreate,
    user: dict | None = Depends(get_optional_user),
):
    """Create a new class."""
    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_id = user["id"] if user else None

    data = {
        "id": new_id,
        "name": body.name,
        "section": body.section,
        "subject": body.subject,
        "total_items": body.total_items,
        "user_id": user_id,
        "created_at": now,
    }

    row = db_insert("classes", data)
    if not row:
        _local_classes[new_id] = data

    return ClassResponse(**data)


@router.put("/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: str,
    body: ClassCreate,
    user: dict | None = Depends(get_optional_user),
):
    """Update an existing class."""
    update_data = {
        "name": body.name,
        "section": body.section,
        "subject": body.subject,
        "total_items": body.total_items,
    }

    row = db_update("classes", class_id, update_data)
    if row:
        return ClassResponse(
            id=row["id"],
            name=row["name"],
            section=row.get("section"),
            subject=row.get("subject"),
            total_items=row.get("total_items", 100),
            user_id=row.get("user_id"),
            created_at=row.get("created_at"),
        )

    if class_id in _local_classes:
        _local_classes[class_id].update(update_data)
        return ClassResponse(**_local_classes[class_id])

    raise HTTPException(status_code=404, detail="Class not found")


@router.delete("/{class_id}")
async def delete_class(class_id: str):
    """Delete a class."""
    if class_id in _local_classes:
        del _local_classes[class_id]
        return {"message": "Deleted"}

    if db_delete("classes", class_id):
        return {"message": "Deleted"}

    raise HTTPException(status_code=404, detail="Class not found")
