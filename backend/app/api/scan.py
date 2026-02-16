"""
Scan API endpoints - Upload image or camera capture for OMR processing.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.api.auth import get_optional_user
from app.api.results import save_result
from app.core.omr_engine import process_omr_image
from app.models.schemas import MarkingScheme, ScanRequest, ScanResult

router = APIRouter(prefix="/api/scan", tags=["scan"])


@router.post("", response_model=ScanResult)
async def scan_uploaded_image(
    file: UploadFile = File(...),
    template_config: str | None = Form(None),
    answer_key: str | None = Form(None),
    marking_scheme: str | None = Form(None),
    student_name: str | None = Form(None),
    class_id: str | None = Form(None),
    answer_key_id: str | None = Form(None),
    user: dict | None = Depends(get_optional_user),
):
    """
    Scan an uploaded OMR sheet image.
    """
    try:
        image_bytes = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read uploaded file")

    # Parse optional JSON form fields
    tmpl_config = None
    if template_config:
        try:
            tmpl_config = json.loads(template_config)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid template_config JSON")

    ak = None
    if answer_key:
        try:
            ak = json.loads(answer_key)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid answer_key JSON")

    ms = None
    if marking_scheme:
        try:
            ms = MarkingScheme(**json.loads(marking_scheme))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid marking_scheme JSON")

    try:
        result = process_omr_image(
            image_data=image_bytes,
            template_config=tmpl_config,
            answer_key=ak,
            marking_scheme=ms,
            is_base64=False,
        )

        # Auto-save result
        user_id = user["id"] if user else None
        save_result(
            detected_answers=result.detected_answers,
            score=result.score,
            total=result.total,
            answer_key_id=answer_key_id,
            student_name=student_name,
            class_id=class_id,
            user_id=user_id,
        )

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OMR processing failed: {str(e)}")


@router.post("/camera", response_model=ScanResult)
async def scan_camera_capture(
    request: ScanRequest,
    user: dict | None = Depends(get_optional_user),
):
    """
    Scan a camera-captured OMR sheet (base64 encoded image).
    """
    try:
        tmpl_config = None
        if request.template_config:
            tmpl_config = request.template_config.model_dump()

        result = process_omr_image(
            image_data=request.image_base64,
            template_config=tmpl_config,
            answer_key=request.answer_key,
            is_base64=True,
        )

        # Auto-save result
        user_id = user["id"] if user else None
        save_result(
            detected_answers=result.detected_answers,
            score=result.score,
            total=result.total,
            answer_key_id=request.answer_key_id,
            student_name=request.student_name,
            class_id=request.class_id,
            user_id=user_id,
        )

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OMR processing failed: {str(e)}")
