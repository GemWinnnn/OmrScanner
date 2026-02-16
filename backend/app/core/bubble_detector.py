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

    # ── Phase 1: Extract all bubble mean intensities ──
    all_q_vals: list[float] = []
    all_q_strip_arrs: list[list[float]] = []
    all_q_std_vals: list[float] = []
    bubble_intensities: dict[str, list[float]] = {}
    all_q_fill_arrs: list[list[float]] = []

    for field_block in template.field_blocks:
        box_w, box_h = field_block.bubble_dimensions
        # Inner-core mask: ignore printed bubble outline; focus on central fill region.
        inner_mask = np.zeros((box_h, box_w), dtype=np.uint8)
        cx, cy = box_w // 2, box_h // 2
        radius = max(4, int(min(box_w, box_h) * 0.28))
        cv2.circle(inner_mask, (cx, cy), radius, 255, -1)
        inner_area = max(1, cv2.countNonZero(inner_mask))
        for field_block_bubbles in field_block.traverse_bubbles:
            q_strip_vals: list[float] = []
            q_fill_vals: list[float] = []
            for pt in field_block_bubbles:
                x, y = pt.x + field_block.shift, pt.y
                roi = img[y : y + box_h, x : x + box_w]
                if roi.size > 0:
                    val = float(cv2.mean(roi)[0])
                else:
                    val = 255.0
                q_strip_vals.append(val)
                if roi.size > 0:
                    # Local adaptive mark signal:
                    # threshold each bubble independently (Otsu) and measure
                    # dark fill only in the inner core region.
                    roi_blur = cv2.GaussianBlur(roi, (3, 3), 0)
                    _, roi_bin_local = cv2.threshold(
                        roi_blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
                    )
                    masked = cv2.bitwise_and(roi_bin_local, inner_mask)
                    fill_ratio = float(cv2.countNonZero(masked)) / float(inner_area)
                else:
                    fill_ratio = 0.0
                q_fill_vals.append(fill_ratio)

            all_q_strip_arrs.append(q_strip_vals)
            all_q_fill_arrs.append(q_fill_vals)
            all_q_std_vals.append(round(float(np.std(q_strip_vals)), 2))
            all_q_vals.extend(q_strip_vals)

            # Store intensities by question label
            if field_block_bubbles:
                label = field_block_bubbles[0].field_label
                bubble_intensities[label] = q_strip_vals

    if not all_q_vals:
        return {}, annotated, {}, 0, 0

    # ── Phase 2: Compute thresholds ──
    global_std_thresh, _, _ = get_global_threshold(all_q_std_vals)
    global_thr, _, _ = get_global_threshold(all_q_vals, looseness=4)

    # ── Phase 3: Detect marked bubbles ──
    omr_response: dict[str, str] = {}
    multi_marked_count = 0
    unmarked_count = 0
    total_q_strip_no = 0
    for field_block in template.field_blocks:
        box_w, box_h = field_block.bubble_dimensions

        for field_block_bubbles in field_block.traverse_bubbles:
            no_outliers = all_q_std_vals[total_q_strip_no] < global_std_thresh
            q_vals = all_q_strip_arrs[total_q_strip_no]

            per_q_strip_threshold = get_local_threshold(
                q_vals,
                global_thr,
                no_outliers,
            )
            marked_indices = set(select_marked_indices(q_vals, per_q_strip_threshold))

            # Secondary decision path for very bright/faint sheets:
            # use darkest-pixel fill ratio per bubble.
            q_fill_vals = all_q_fill_arrs[total_q_strip_no]
            if q_fill_vals:
                order_fill = sorted(range(len(q_fill_vals)), key=lambda i: q_fill_vals[i], reverse=True)
                top_fill = q_fill_vals[order_fill[0]]
                second_fill = q_fill_vals[order_fill[1]] if len(order_fill) > 1 else 0.0
                fill_gap = top_fill - second_fill

                # If threshold-based read found nothing but one bubble has clear fill lead,
                # trust fill-ratio signal (helps light pencil marks on bright sheets).
                if len(marked_indices) == 0 and top_fill >= 0.06 and fill_gap >= 0.015:
                    marked_indices = {order_fill[0]}

                # If threshold-based read marks too many, resolve to strongest fill.
                if len(marked_indices) >= 2 and top_fill >= 0.07 and fill_gap >= 0.015:
                    marked_indices = {order_fill[0]}

            detected_bubbles = []
            for idx, bubble in enumerate(field_block_bubbles):
                bubble_is_marked = idx in marked_indices

                x, y = bubble.x + field_block.shift, bubble.y

                if bubble_is_marked:
                    detected_bubbles.append(bubble)
                    # Draw filled green rectangle for detected bubbles
                    cv2.rectangle(
                        annotated,
                        (int(x + box_w / 12), int(y + box_h / 12)),
                        (int(x + box_w - box_w / 12), int(y + box_h - box_h / 12)),
                        (0, 200, 0),  # green
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
                    # Draw light gray rectangle for unmarked bubbles
                    cv2.rectangle(
                        annotated,
                        (int(x + box_w / 10), int(y + box_h / 10)),
                        (int(x + box_w - box_w / 10), int(y + box_h - box_h / 10)),
                        (180, 180, 180),
                        1,
                    )

            # Build response
            for bubble in detected_bubbles:
                if bubble.field_label in omr_response:
                    omr_response[bubble.field_label] += bubble.field_value
                    multi_marked_count += 1
                else:
                    omr_response[bubble.field_label] = bubble.field_value

            if len(detected_bubbles) == 0:
                label = field_block_bubbles[0].field_label
                omr_response[label] = field_block.empty_val
                unmarked_count += 1

            total_q_strip_no += 1

    return omr_response, annotated, bubble_intensities, multi_marked_count, unmarked_count
