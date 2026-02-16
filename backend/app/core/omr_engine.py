"""
OMR Engine: orchestrates the full scan pipeline.
"""

from __future__ import annotations

from app.core.bubble_detector import detect_bubbles
from app.core.evaluator import evaluate_response
from app.core.image_processing import (
    decode_base64_image,
    encode_image_to_base64,
    preprocess_omr_image,
    read_image_file,
    resize_image,
)
from app.core.template_parser import ParsedTemplate
from app.models.schemas import (
    DEFAULT_TEMPLATE_CONFIG,
    MarkingScheme,
    ScanResult,
)


def process_omr_image(
    image_data: bytes | str,
    template_config: dict | None = None,
    answer_key: dict[str, str] | None = None,
    marking_scheme: MarkingScheme | None = None,
    is_base64: bool = False,
) -> ScanResult:
    """
    Full OMR processing pipeline.

    Args:
        image_data: Raw image bytes or base64 string.
        template_config: Template configuration dict. Uses default 100-Q template if None.
        answer_key: Dict of question->answer for scoring. Optional.
        marking_scheme: Scoring scheme. Optional.
        is_base64: Whether image_data is a base64 string.

    Returns:
        ScanResult with detected answers, score, and annotated image.
    """
    # 1. Decode image
    if is_base64:
        img = decode_base64_image(image_data)
    else:
        img = read_image_file(image_data)

    # 2. Parse template
    config = template_config or DEFAULT_TEMPLATE_CONFIG
    template = ParsedTemplate(config)

    # 3. Preprocess: marker-based crop → fallback to contour crop → normalize
    #    Uses the bundled omr_marker.png by default.
    #    sheetToMarkerWidthRatio comes from the template (sample7 uses 17).
    sheet_to_marker_ratio = 17
    pre_processors = config.get("preProcessors", [])
    for pp in pre_processors:
        if pp.get("name") == "CropOnMarkers":
            opts = pp.get("options", {})
            sheet_to_marker_ratio = opts.get("sheetToMarkerWidthRatio", 17)
            break

    img = preprocess_omr_image(
        img,
        sheet_to_marker_width_ratio=sheet_to_marker_ratio,
    )

    # 4. Resize to template page dimensions
    page_w, page_h = template.page_dimensions
    img = resize_image(img, page_w, page_h)

    # 5. Detect bubbles
    omr_response, annotated, bubble_intensities, multi_marked, unmarked = detect_bubbles(
        img, template
    )

    # 6. Evaluate if answer key provided
    score = None
    total = None
    percentage = None
    bubble_details = []

    if answer_key:
        score, total, bubble_details = evaluate_response(
            omr_response, answer_key, marking_scheme, bubble_intensities
        )
        if total > 0:
            percentage = round((score / total) * 100, 2)

    # 7. Encode annotated image
    annotated_b64 = encode_image_to_base64(annotated)

    return ScanResult(
        detected_answers=omr_response,
        score=score,
        total=total,
        percentage=percentage,
        bubble_details=bubble_details,
        multi_marked_count=multi_marked,
        unmarked_count=unmarked,
        annotated_image_base64=annotated_b64,
    )
