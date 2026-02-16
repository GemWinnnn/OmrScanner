"""
Bubble detection with adaptive thresholding.
Ported from OMRChecker/src/core.py - get_global_threshold and get_local_threshold.
"""

from __future__ import annotations

import cv2
import numpy as np

from app.core.template_parser import ParsedTemplate

# Constants from OMRChecker
GLOBAL_PAGE_THRESHOLD_WHITE = 200
GLOBAL_PAGE_THRESHOLD_BLACK = 100
MIN_JUMP = 25
JUMP_DELTA = 30
CONFIDENT_SURPLUS = 25
MIN_GAP = 30
SINGLE_MARK_GAP = 8.0
MULTI_MARK_NEAR_GAP = 6.0


def get_global_threshold(
    q_vals_orig: list[float],
    looseness: int = 1,
    page_type: str = "white",
) -> tuple[float, float, float]:
    """
    Find the global threshold using the 'first large gap' method.
    Returns (threshold, jump_low, jump_high).
    """
    global_default = GLOBAL_PAGE_THRESHOLD_WHITE if page_type == "white" else GLOBAL_PAGE_THRESHOLD_BLACK

    q_vals = sorted(q_vals_orig)
    n = len(q_vals)
    if n == 0:
        return global_default, global_default, global_default

    ls = (looseness + 1) // 2
    l = n - ls
    max1, thr1 = MIN_JUMP, global_default

    for i in range(ls, l):
        jump = q_vals[i + ls] - q_vals[i - ls]
        if jump > max1:
            max1 = jump
            thr1 = q_vals[i - ls] + jump / 2

    # Second pass for safety (deprecated but kept for compatibility)
    max2, thr2 = MIN_JUMP, global_default
    for i in range(ls, l):
        jump = q_vals[i + ls] - q_vals[i - ls]
        new_thr = q_vals[i - ls] + jump / 2
        if jump > max2 and abs(thr1 - new_thr) > JUMP_DELTA:
            max2 = jump
            thr2 = new_thr

    global_thr = thr1
    j_low = thr1 - max1 // 2
    j_high = thr1 + max1 // 2

    return global_thr, j_low, j_high


def get_local_threshold(
    q_vals_orig: list[float],
    global_thr: float,
    no_outliers: bool,
) -> float:
    """
    Get per-question threshold.
    For questions with no outliers (all black or all white), use global threshold.
    Otherwise find the largest gap in the question's bubble values.
    """
    q_vals = sorted(q_vals_orig)
    n = len(q_vals)

    if n < 3:
        if np.max(q_vals) - np.min(q_vals) < MIN_GAP:
            return global_thr
        return float(np.mean(q_vals))

    l = n - 1
    max1, thr1 = MIN_JUMP, 255.0

    for i in range(1, l):
        jump = q_vals[i + 1] - q_vals[i - 1]
        if jump > max1:
            max1 = jump
            thr1 = q_vals[i - 1] + jump / 2

    confident_jump = MIN_JUMP + CONFIDENT_SURPLUS
    if max1 < confident_jump:
        # In low-confidence cases, always fall back to global threshold.
        # Keeping thr1 at 255 causes runaway "all bubbles marked" behavior.
        thr1 = global_thr

    # Guardrails: ensure threshold lives within strip range.
    qmin = float(np.min(q_vals))
    qmax = float(np.max(q_vals))
    if thr1 >= qmax:
        thr1 = (qmin + qmax) / 2.0
    elif thr1 <= qmin:
        thr1 = global_thr

    return thr1


def select_marked_indices(q_vals: list[float], threshold: float) -> list[int]:
    """
    Robust bubble selection for one question strip.

    Primary rule: values darker than threshold are marked.
    Fallbacks:
    - If threshold marks all choices, pick only the darkest when clearly separated.
    - If multiple are marked but one is clearly darkest, keep only that one.
    """
    marked = [i for i, v in enumerate(q_vals) if v < threshold]
    if not marked:
        return []

    # Threshold runaway: everything marked (common when local_thr drifts too high)
    if len(marked) == len(q_vals):
        order = sorted(range(len(q_vals)), key=lambda i: q_vals[i])
        darkest, second = order[0], order[1]
        if q_vals[second] - q_vals[darkest] >= SINGLE_MARK_GAP:
            return [darkest]
        return []

    # If more than one marked, only keep near-darkest bubbles unless one is dominant
    if len(marked) > 1:
        order = sorted(marked, key=lambda i: q_vals[i])
        darkest = order[0]
        second = order[1]
        if q_vals[second] - q_vals[darkest] >= SINGLE_MARK_GAP:
            return [darkest]
        return [i for i in marked if q_vals[i] - q_vals[darkest] <= MULTI_MARK_NEAR_GAP]

    return marked


def detect_bubbles(
    img: np.ndarray,
    template: ParsedTemplate,
) -> tuple[dict[str, str], np.ndarray, dict[str, list[float]], int, int]:
    """
    Main bubble detection routine.

    Args:
        img: Grayscale image resized to template page dimensions.
        template: Parsed template with bubble grid.

    Returns:
        (omr_response, annotated_image, bubble_intensities, multi_marked_count, unmarked_count)
    """
    page_w, page_h = template.page_dimensions
    img = cv2.resize(img, (page_w, page_h))

    # Normalize
    if img.max() > img.min():
        img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)

    # Create annotated image (color)
    annotated = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    # Template-locked detection:
    # For each question row, score each bubble at fixed coordinates and select the
    # darkest/most filled candidate if confidence passes thresholds.
    bubble_intensities: dict[str, list[float]] = {}
    omr_response: dict[str, str] = {}
    multi_marked_count = 0
    unmarked_count = 0

    for field_block in template.field_blocks:
        box_w, box_h = field_block.bubble_dimensions

        # Central mask ignores printed bubble outline.
        core_mask = np.zeros((box_h, box_w), dtype=np.uint8)
        cx, cy = box_w // 2, box_h // 2
        core_radius = max(4, int(min(box_w, box_h) * 0.28))
        cv2.circle(core_mask, (cx, cy), core_radius, 255, -1)
        core_area = max(1, cv2.countNonZero(core_mask))

        # Ring mask estimates local background around the core.
        outer_mask = np.zeros((box_h, box_w), dtype=np.uint8)
        outer_radius = max(core_radius + 2, int(min(box_w, box_h) * 0.42))
        cv2.circle(outer_mask, (cx, cy), outer_radius, 255, -1)
        ring_mask = cv2.subtract(outer_mask, core_mask)
        ring_area = max(1, cv2.countNonZero(ring_mask))

        for field_block_bubbles in field_block.traverse_bubbles:
            if not field_block_bubbles:
                continue

            label = field_block_bubbles[0].field_label
            q_core_means: list[float] = []
            q_scores: list[float] = []

            for bubble in field_block_bubbles:
                x, y = bubble.x + field_block.shift, bubble.y
                roi = img[y : y + box_h, x : x + box_w]

                if roi.shape[0] != box_h or roi.shape[1] != box_w:
                    q_core_means.append(255.0)
                    q_scores.append(0.0)
                    continue

                roi_blur = cv2.GaussianBlur(roi, (3, 3), 0)
                core_mean = float(cv2.mean(roi_blur, mask=core_mask)[0])
                ring_mean = float(cv2.mean(roi_blur, mask=ring_mask)[0]) if ring_area > 0 else core_mean
                contrast_darkness = max(0.0, ring_mean - core_mean)

                # Per-bubble fill ratio from local Otsu threshold.
                _, roi_bin = cv2.threshold(
                    roi_blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
                )
                fill_ratio = float(cv2.countNonZero(cv2.bitwise_and(roi_bin, core_mask))) / float(core_area)

                # Composite mark score:
                # - contrast_darkness: filled centre should be darker than ring
                # - fill_ratio: stronger fill contributes higher confidence
                score = contrast_darkness + (fill_ratio * 85.0)

                q_core_means.append(core_mean)
                q_scores.append(score)

            bubble_intensities[label] = q_core_means

            # Pick darkest/strongest bubble in the row.
            ranked = sorted(range(len(q_scores)), key=lambda i: q_scores[i], reverse=True)
            best_idx = ranked[0]
            best_score = q_scores[best_idx]
            second_score = q_scores[ranked[1]] if len(ranked) > 1 else 0.0
            score_gap = best_score - second_score

            # Confidence gates:
            # - absolute score floor avoids false positives on blank rows
            # - score gap prefers a clear winner in the row
            is_confident_mark = best_score >= 12.0 and (score_gap >= 1.5 or best_score >= 18.0)
            chosen_idx = best_idx if is_confident_mark else None

            for idx, bubble in enumerate(field_block_bubbles):
                x, y = bubble.x + field_block.shift, bubble.y
                is_marked = chosen_idx is not None and idx == chosen_idx

                if is_marked:
                    cv2.rectangle(
                        annotated,
                        (int(x + box_w / 12), int(y + box_h / 12)),
                        (int(x + box_w - box_w / 12), int(y + box_h - box_h / 12)),
                        (0, 200, 0),
                        3,
                    )
                    cv2.putText(
                        annotated,
                        str(bubble.field_value),
                        (x + 5, y + box_h - 5),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (0, 180, 0),
                        2,
                    )
                else:
                    cv2.rectangle(
                        annotated,
                        (int(x + box_w / 10), int(y + box_h / 10)),
                        (int(x + box_w - box_w / 10), int(y + box_h - box_h / 10)),
                        (180, 180, 180),
                        1,
                    )

            if chosen_idx is None:
                omr_response[label] = field_block.empty_val
                unmarked_count += 1
            else:
                omr_response[label] = field_block_bubbles[chosen_idx].field_value

    return omr_response, annotated, bubble_intensities, multi_marked_count, unmarked_count
