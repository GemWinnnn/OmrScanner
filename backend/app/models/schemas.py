"""Pydantic models for the OMR Scanner API."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ─── Template Models ───────────────────────────────────────────────

class FieldBlockSchema(BaseModel):
    fieldType: str = "QTYPE_MCQ5"
    fieldLabels: list[str]
    origin: list[float]
    bubblesGap: float
    labelsGap: float
    direction: str = "vertical"


class TemplateConfig(BaseModel):
    pageDimensions: list[int] = [1700, 2600]
    bubbleDimensions: list[int] = [42, 42]
    fieldBlocks: dict[str, FieldBlockSchema]
    customLabels: dict[str, Any] = {}
    outputColumns: list[str] = []
    emptyValue: str = ""


class TemplateCreate(BaseModel):
    name: str
    config: TemplateConfig


class TemplateResponse(BaseModel):
    id: str
    name: str
    config: dict
    user_id: str | None = None
    created_at: str | None = None


# ─── Answer Key Models ─────────────────────────────────────────────

class MarkingScheme(BaseModel):
    correct: float = 1.0
    incorrect: float = 0.0
    unmarked: float = 0.0


class AnswerKeyCreate(BaseModel):
    name: str
    template_id: str | None = None
    class_id: str | None = None
    answers: dict[str, str]  # e.g. {"q1": "C", "q2": "A", ...}
    marking_scheme: MarkingScheme = MarkingScheme()
    total_items: int | None = None


class AnswerKeyResponse(BaseModel):
    id: str
    name: str
    template_id: str | None = None
    class_id: str | None = None
    answers: dict[str, str]
    marking_scheme: dict
    total_items: int | None = None
    user_id: str | None = None
    created_at: str | None = None


# ─── Scan Models ───────────────────────────────────────────────────

class BubbleResult(BaseModel):
    question: str
    marked: str
    correct: str | None = None
    is_correct: bool | None = None
    intensity_values: list[float] = []


class ScanRequest(BaseModel):
    """For camera-based scan with base64 image."""
    image_base64: str
    template_id: str | None = None
    answer_key_id: str | None = None
    # Inline template config (used when no template_id)
    template_config: TemplateConfig | None = None
    # Inline answer key (used when no answer_key_id)
    answer_key: dict[str, str] | None = None
    # Student / class info for grade recording
    student_name: str | None = None
    class_id: str | None = None


class ScanResult(BaseModel):
    detected_answers: dict[str, str]
    score: float | None = None
    total: int | None = None
    percentage: float | None = None
    bubble_details: list[BubbleResult] = []
    multi_marked_count: int = 0
    unmarked_count: int = 0
    annotated_image_base64: str | None = None


class ScanResultDB(BaseModel):
    id: str
    template_id: str | None = None
    answer_key_id: str | None = None
    class_id: str | None = None
    student_name: str | None = None
    image_url: str | None = None
    detected_answers: dict[str, str]
    score: float | None = None
    total: int | None = None
    user_id: str | None = None
    created_at: str | None = None


# ─── Class Models ─────────────────────────────────────────────────

class ClassCreate(BaseModel):
    name: str
    section: str | None = None
    subject: str | None = None
    total_items: int = 100


class ClassResponse(BaseModel):
    id: str
    name: str
    section: str | None = None
    subject: str | None = None
    total_items: int = 100
    user_id: str | None = None
    created_at: str | None = None


# ─── Default Template ──────────────────────────────────────────────

FIELD_TYPES = {
    "QTYPE_INT": {
        "bubbleValues": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        "direction": "vertical",
    },
    "QTYPE_INT_FROM_1": {
        "bubbleValues": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        "direction": "vertical",
    },
    "QTYPE_MCQ4": {
        "bubbleValues": ["A", "B", "C", "D"],
        "direction": "horizontal",
    },
    "QTYPE_MCQ5": {
        "bubbleValues": ["A", "B", "C", "D", "E"],
        "direction": "horizontal",
    },
}

DEFAULT_TEMPLATE_CONFIG: dict = {
    "pageDimensions": [1700, 2600],
    "bubbleDimensions": [42, 42],
    "fieldBlocks": {
        "Column1_Q1_25": {
            "fieldType": "QTYPE_MCQ5",
            "fieldLabels": [f"q{i}" for i in range(1, 26)],
            "origin": [90, 680],
            "bubblesGap": 57,
            "labelsGap": 75.6,
            "direction": "vertical",
        },
        "Column2_Q26_50": {
            "fieldType": "QTYPE_MCQ5",
            "fieldLabels": [f"q{i}" for i in range(26, 51)],
            "origin": [530, 680],
            "bubblesGap": 57,
            "labelsGap": 75.6,
            "direction": "vertical",
        },
        "Column3_Q51_75": {
            "fieldType": "QTYPE_MCQ5",
            "fieldLabels": [f"q{i}" for i in range(51, 76)],
            "origin": [970, 680],
            "bubblesGap": 57,
            "labelsGap": 75.6,
            "direction": "vertical",
        },
        "Column4_Q76_100": {
            "fieldType": "QTYPE_MCQ5",
            "fieldLabels": [f"q{i}" for i in range(76, 101)],
            "origin": [1410, 680],
            "bubblesGap": 57,
            "labelsGap": 75.6,
            "direction": "vertical",
        },
    },
    "customLabels": {},
    "outputColumns": [f"q{i}" for i in range(1, 101)],
    "emptyValue": "",
}
