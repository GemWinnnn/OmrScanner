"""
Template CRUD API endpoints.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_optional_user
from app.models.schemas import DEFAULT_TEMPLATE_CONFIG, TemplateCreate, TemplateResponse
from app.services.supabase_client import db_delete, db_insert, db_select, db_select_one

router = APIRouter(prefix="/api/templates", tags=["templates"])

# In-memory store as fallback when Supabase is not configured
_local_templates: dict[str, dict] = {}


def _init_default_template():
    """Ensure the default template always exists."""
    if "default" not in _local_templates:
        _local_templates["default"] = {
            "id": "default",
            "name": "100-Question MCQ (5 choices)",
            "config": DEFAULT_TEMPLATE_CONFIG,
            "user_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }


_init_default_template()


@router.get("", response_model=list[TemplateResponse])
async def list_templates():
    """List all templates."""
    # Try Supabase first
    rows = db_select("templates")
    if rows:
        results = []
        for r in rows:
            cfg = r.get("config_json", r.get("config", {}))
            if isinstance(cfg, str):
                cfg = json.loads(cfg)
            results.append(TemplateResponse(
                id=r["id"],
                name=r["name"],
                config=cfg,
                user_id=r.get("user_id"),
                created_at=r.get("created_at"),
            ))
        # Prepend default template
        _init_default_template()
        results.insert(0, TemplateResponse(**_local_templates["default"]))
        return results

    # Fallback to local store
    _init_default_template()
    return [TemplateResponse(**t) for t in _local_templates.values()]


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str):
    """Get a single template by ID."""
    if template_id in _local_templates:
        return TemplateResponse(**_local_templates[template_id])

    row = db_select_one("templates", template_id)
    if row:
        cfg = row.get("config_json", row.get("config", {}))
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        return TemplateResponse(
            id=row["id"],
            name=row["name"],
            config=cfg,
            user_id=row.get("user_id"),
            created_at=row.get("created_at"),
        )
    raise HTTPException(status_code=404, detail="Template not found")


@router.post("", response_model=TemplateResponse)
async def create_template(
    template: TemplateCreate,
    user: dict | None = Depends(get_optional_user),
):
    """Create a new template."""
    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_id = user["id"] if user else None
    data = {
        "id": new_id,
        "name": template.name,
        "config": template.config.model_dump(),
        "user_id": user_id,
        "created_at": now,
    }

    # Try Supabase
    row = db_insert("templates", {
        "id": new_id,
        "name": template.name,
        "config_json": json.dumps(template.config.model_dump()),
        "user_id": user_id,
        "created_at": now,
    })

    if not row:
        # Fallback to local
        _local_templates[new_id] = data

    return TemplateResponse(**data)


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    """Delete a template."""
    if template_id == "default":
        raise HTTPException(status_code=400, detail="Cannot delete default template")

    if template_id in _local_templates:
        del _local_templates[template_id]
        return {"message": "Deleted"}

    if db_delete("templates", template_id):
        return {"message": "Deleted"}

    raise HTTPException(status_code=404, detail="Template not found")
