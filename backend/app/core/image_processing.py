"""
Image preprocessing utilities for the OMR scanner.
Ported from OMRChecker/src/utils/image.py and CropOnMarkers processor.
"""

from __future__ import annotations

import base64
import logging
import os
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ─── Path to the bundled marker image ─────────────────────────────
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
DEFAULT_MARKER_PATH = str(ASSETS_DIR / "omr_marker.png")

# ─── Constants from OMRChecker/src/constants/image_processing.py ──
EROSION_KERNEL_SIZE = (5, 5)
EROSION_ITERATIONS = 5
GAUSSIAN_BLUR_MARKER = {"kernel_size": (5, 5), "sigma_x": 0}
QUADRANT_H_FACTOR = 3       # image is split at 1/3 height
QUADRANT_W_FACTOR = 2       # image is split at 1/2 width


# ═══════════════════════════════════════════════════════════════════
#  Basic utilities
# ═══════════════════════════════════════════════════════════════════

def decode_base64_image(b64_string: str) -> np.ndarray:
    """Decode a base64-encoded image to an OpenCV numpy array (grayscale)."""
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    img_bytes = base64.b64decode(b64_string)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Could not decode image from base64 data")
    return img


def read_image_file(file_bytes: bytes) -> np.ndarray:
    """Read image from uploaded file bytes into grayscale OpenCV array."""
    nparr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Could not decode uploaded image file")
    return img


def encode_image_to_base64(img: np.ndarray, fmt: str = ".jpg") -> str:
    """Encode an OpenCV image to base64 string."""
    _, buffer = cv2.imencode(fmt, img)
    return base64.b64encode(buffer).decode("utf-8")


def resize_image(img: np.ndarray, width: int, height: int | None = None) -> np.ndarray:
    """Resize image.  If height is None, preserve aspect ratio."""
    if height is None:
        h, w = img.shape[:2]
        height = int(h * width / w)
    return cv2.resize(img, (int(width), int(height)))


def resize_image_h(img: np.ndarray, height: int) -> np.ndarray:
    """Resize image to a target height, preserving aspect ratio."""
    h, w = img.shape[:2]
    width = int(w * height / h)
    return cv2.resize(img, (int(width), int(height)))


def normalize_image(img: np.ndarray, alpha: int = 0, beta: int = 255) -> np.ndarray:
    """Normalize image to [alpha, beta] range."""
    if img.max() > img.min():
        return cv2.normalize(img, None, alpha, beta, cv2.NORM_MINMAX)
    return img


def remove_shadows(img: np.ndarray, blur_sigma: int = 31) -> np.ndarray:
    """
    Reduce uneven illumination/shadows while preserving bubble edges.
    Uses background division + CLAHE.
    """
    if img.dtype != np.uint8:
        work = normalize_image(img).astype(np.uint8)
    else:
        work = img.copy()

    # Estimate smooth background illumination
    bg = cv2.GaussianBlur(work, (0, 0), blur_sigma)
    # Divide to flatten lighting
    flattened = cv2.divide(work, bg, scale=255)
    # Local contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(flattened)
    return normalize_image(enhanced)


def adjust_gamma(image: np.ndarray, gamma: float = 1.0) -> np.ndarray:
    """Apply gamma correction."""
    inv_gamma = 1.0 / gamma
    table = np.array(
        [((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]
    ).astype("uint8")
    return cv2.LUT(image, table)


# ═══════════════════════════════════════════════════════════════════
#  Perspective transform
# ═══════════════════════════════════════════════════════════════════

def order_points(pts: np.ndarray) -> np.ndarray:
    """Order 4 points: top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Apply 4-point perspective transform to get a top-down view."""
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    width_a = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    width_b = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    max_width = max(int(width_a), int(width_b))

    height_a = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    height_b = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    max_height = max(int(height_a), int(height_b))

    dst = np.array(
        [[0, 0], [max_width - 1, 0],
         [max_width - 1, max_height - 1], [0, max_height - 1]],
        dtype="float32",
    )

    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (max_width, max_height))


# ═══════════════════════════════════════════════════════════════════
#  CropOnMarkers  (ported from OMRChecker/src/processors/CropOnMarkers.py)
# ═══════════════════════════════════════════════════════════════════

def _load_marker(
    marker_path: str,
    processing_width: int,
    sheet_to_marker_width_ratio: int = 17,
    apply_erode_subtract: bool = False,
) -> np.ndarray:
    """
    Load the marker template, resize relative to the processing page width,
    blur, and normalize.  Optionally apply erode-subtract for edge enhancement.
    """
    if not os.path.exists(marker_path):
        raise FileNotFoundError(f"Marker image not found: {marker_path}")

    marker = cv2.imread(marker_path, cv2.IMREAD_GRAYSCALE)
    if marker is None:
        raise ValueError(f"Could not read marker image: {marker_path}")

    # Resize marker relative to page width
    marker = resize_image(marker, processing_width // sheet_to_marker_width_ratio)

    # Blur to soften edges for template matching
    marker = cv2.GaussianBlur(
        marker,
        GAUSSIAN_BLUR_MARKER["kernel_size"],
        GAUSSIAN_BLUR_MARKER["sigma_x"],
    )

    # Normalize
    marker = cv2.normalize(marker, None, 0, 255, cv2.NORM_MINMAX)

    # Erode-subtract: highlights edges making marker more distinctive (for noisy images)
    if apply_erode_subtract:
        eroded = cv2.erode(
            marker,
            kernel=np.ones(EROSION_KERNEL_SIZE),
            iterations=EROSION_ITERATIONS,
        )
        marker = cv2.subtract(marker, eroded)

    return marker


def _get_best_marker_scale(
    image_processed: np.ndarray,
    marker: np.ndarray,
    scale_range: tuple[int, int] = (35, 100),
    scale_steps: int = 10,
    min_matching_threshold: float = 0.3,
) -> tuple[float | None, float]:
    """
    Try different scales of the marker and find the one with the highest
    template-match score against the full image.

    Returns (best_scale, best_match_score).
    """
    descent = (scale_range[1] - scale_range[0]) // scale_steps
    _h, _w = marker.shape[:2]
    best_scale = None
    all_max_t = 0.0

    for r0 in np.arange(scale_range[1], scale_range[0], -1 * descent):
        s = float(r0) / 100.0
        if s <= 0.0:
            continue
        rescaled = resize_image_h(marker, int(_h * s))
        # Skip if rescaled marker is larger than image
        if rescaled.shape[0] >= image_processed.shape[0] or rescaled.shape[1] >= image_processed.shape[1]:
            continue
        res = cv2.matchTemplate(image_processed, rescaled, cv2.TM_CCOEFF_NORMED)
        max_t = float(res.max())
        if max_t > all_max_t:
            best_scale = s
            all_max_t = max_t

    if all_max_t < min_matching_threshold:
        logger.warning(
            f"Marker matching score too low ({all_max_t:.3f} < {min_matching_threshold}). "
            "The image may not have recognizable corner markers."
        )

    return best_scale, all_max_t


def _match_markers_in_quadrants(
    image: np.ndarray,
    image_processed: np.ndarray,
    marker: np.ndarray,
    min_matching_threshold: float,
    max_matching_variation: float,
    scale_range: tuple[int, int],
    scale_steps: int,
) -> np.ndarray | None:
    """
    Core marker matching: split image into quadrants, find marker in each,
    and apply perspective transform.  Returns warped image or None.
    """
    h1, w1 = image_processed.shape[:2]
    midh = h1 // QUADRANT_H_FACTOR
    midw = w1 // QUADRANT_W_FACTOR

    origins = [[0, 0], [midw, 0], [0, midh], [midw, midh]]
    quads = [
        image_processed[0:midh, 0:midw],
        image_processed[0:midh, midw:w1],
        image_processed[midh:h1, 0:midw],
        image_processed[midh:h1, midw:w1],
    ]

    # Draw dividing lines so the marker doesn't match the border
    image_processed[:, midw:midw + 2] = 255
    image_processed[midh:midh + 2, :] = 255

    # Find the best marker scale on the full image
    best_scale, all_max_t = _get_best_marker_scale(
        image_processed, marker, scale_range, scale_steps, min_matching_threshold,
    )
    if best_scale is None:
        return None

    optimal_marker = resize_image_h(marker, int(marker.shape[0] * best_scale))
    m_h, m_w = optimal_marker.shape[:2]

    # Match in each quadrant
    centres: list[list[float]] = []
    quarter_scores: list[float] = []

    # Expected corner positions (where markers should be)
    expected_corners = [
        (0, 0),           # Q0: top-left corner
        (w1, 0),          # Q1: top-right corner
        (0, h1),          # Q2: bottom-left corner
        (w1, h1),         # Q3: bottom-right corner
    ]

    for k in range(4):
        quad = quads[k]
        if optimal_marker.shape[0] >= quad.shape[0] or optimal_marker.shape[1] >= quad.shape[1]:
            return None

        res = cv2.matchTemplate(quad, optimal_marker, cv2.TM_CCOEFF_NORMED)
        max_t = float(res.max())
        quarter_scores.append(max_t)

        if max_t < min_matching_threshold:
            return None
        if abs(all_max_t - max_t) >= max_matching_variation:
            return None

        pt = np.argwhere(res == max_t)[0]
        pt = [pt[1], pt[0]]  # (x, y)
        pt[0] += origins[k][0]
        pt[1] += origins[k][1]
        cx = pt[0] + m_w / 2.0
        cy = pt[1] + m_h / 2.0

        # Sanity check: marker centre must be in the correct corner region
        # (within 40% of image dims from the expected corner)
        ex, ey = expected_corners[k]
        max_dist_x = w1 * 0.4
        max_dist_y = h1 * 0.4
        if abs(cx - ex) > max_dist_x or abs(cy - ey) > max_dist_y:
            logger.warning(
                f"Q{k+1}: marker at ({cx:.0f},{cy:.0f}) too far from "
                f"expected corner ({ex},{ey}) — likely false positive."
            )
            return None

        centres.append([cx, cy])

    logger.info(
        f"Marker matching — Q1:{quarter_scores[0]:.3f}  Q2:{quarter_scores[1]:.3f}  "
        f"Q3:{quarter_scores[2]:.3f}  Q4:{quarter_scores[3]:.3f}  scale:{best_scale:.2f}"
    )

    # Validate that centres form a sensible quadrilateral
    pts = np.array(centres)
    ordered = order_points(pts)
    tl, tr, br, bl = ordered
    # Width and height of detected quad should be > 30% of image dims
    detected_w = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
    detected_h = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
    if detected_w < w1 * 0.3 or detected_h < h1 * 0.3:
        logger.warning(
            f"Detected marker quad too small ({detected_w:.0f}x{detected_h:.0f} "
            f"vs image {w1}x{h1}) — likely false positives."
        )
        return None

    warped = four_point_transform(image, pts)
    return warped


def _detect_marker_centres_by_square_contours(
    image_processed: np.ndarray,
    sheet_to_marker_width_ratio: int,
) -> list[list[float]] | None:
    """
    Detect the 4 black square corner markers via contour analysis in each quadrant.
    More robust than template matching on heavily shadowed images.
    """
    h, w = image_processed.shape[:2]
    midh = h // QUADRANT_H_FACTOR
    midw = w // QUADRANT_W_FACTOR
    quads = [
        image_processed[0:midh, 0:midw],
        image_processed[0:midh, midw:w],
        image_processed[midh:h, 0:midw],
        image_processed[midh:h, midw:w],
    ]
    origins = [[0, 0], [midw, 0], [0, midh], [midw, midh]]
    expected_local = [
        (0, 0),                     # TL
        (quads[1].shape[1], 0),     # TR
        (0, quads[2].shape[0]),     # BL
        (quads[3].shape[1], quads[3].shape[0]),  # BR
    ]

    expected_size = max(8.0, float(w) / float(sheet_to_marker_width_ratio))
    min_area = (expected_size * 0.25) ** 2
    max_area = (expected_size * 2.5) ** 2
    centres: list[list[float]] = []

    for idx, quad in enumerate(quads):
        proc = remove_shadows(quad, blur_sigma=21)
        proc = cv2.GaussianBlur(proc, (3, 3), 0)
        thr = cv2.adaptiveThreshold(
            proc, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 7
        )
        thr = cv2.morphologyEx(
            thr, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        )

        contours, _ = cv2.findContours(thr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        best_score = -1e9
        best_centre = None
        ex, ey = expected_local[idx]
        qh, qw = quad.shape[:2]
        diag = max(1.0, float(np.hypot(qw, qh)))

        for cnt in contours:
            area = float(cv2.contourArea(cnt))
            if area < min_area or area > max_area:
                continue
            peri = cv2.arcLength(cnt, True)
            if peri <= 0:
                continue
            approx = cv2.approxPolyDP(cnt, 0.05 * peri, True)
            if len(approx) < 4 or len(approx) > 6:
                continue

            x, y, bw, bh = cv2.boundingRect(cnt)
            if bw < 5 or bh < 5:
                continue
            aspect = bw / float(bh)
            if aspect < 0.65 or aspect > 1.35:
                continue

            hull = cv2.convexHull(cnt)
            hull_area = max(float(cv2.contourArea(hull)), 1.0)
            solidity = area / hull_area
            if solidity < 0.7:
                continue

            cx = x + bw / 2.0
            cy = y + bh / 2.0
            corner_dist = float(np.hypot(cx - ex, cy - ey)) / diag
            # Prefer large, square-ish contours close to expected corner
            score = area - (corner_dist * expected_size * expected_size)
            if score > best_score:
                best_score = score
                best_centre = (cx, cy)

        if best_centre is None:
            return None

        gx = best_centre[0] + origins[idx][0]
        gy = best_centre[1] + origins[idx][1]
        centres.append([gx, gy])

    return centres


def crop_on_markers_contour(
    image: np.ndarray,
    sheet_to_marker_width_ratio: int = 17,
) -> np.ndarray | None:
    """
    Marker-based crop using contour square detection (shadow-robust fallback).
    """
    work = remove_shadows(image, blur_sigma=27)
    centres = _detect_marker_centres_by_square_contours(work, sheet_to_marker_width_ratio)
    if centres is None:
        return None

    pts = np.array(centres, dtype=np.float32)
    ordered = order_points(pts)
    tl, tr, br, bl = ordered
    h, w = image.shape[:2]
    detected_w = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
    detected_h = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
    if detected_w < w * 0.35 or detected_h < h * 0.35:
        return None

    return four_point_transform(image, pts)


def crop_on_markers(
    image: np.ndarray,
    marker_path: str | None = None,
    processing_width: int | None = None,
    sheet_to_marker_width_ratio: int = 17,
    min_matching_threshold: float = 0.3,
    max_matching_variation: float = 0.41,
    scale_range: tuple[int, int] = (35, 100),
    scale_steps: int = 10,
) -> np.ndarray | None:
    """
    Detect the four corner markers on an OMR sheet and apply a perspective
    transform to produce a clean, axis-aligned image.

    Uses a two-pass strategy:
      Pass 1: Match raw marker against normalized image (best for clean images).
      Pass 2: Match erode-subtracted marker against erode-subtracted image
              (better for noisy/textured scans).

    Returns the warped image, or None if markers could not be found.
    """
    if marker_path is None:
        marker_path = DEFAULT_MARKER_PATH

    h_img, w_img = image.shape[:2]
    if processing_width is None:
        processing_width = w_img

    match_args = dict(
        min_matching_threshold=min_matching_threshold,
        max_matching_variation=max_matching_variation,
        scale_range=scale_range,
        scale_steps=scale_steps,
    )

    # ── Pass 1: contour-based square marker detection (best under shadows) ──
    contour_result = crop_on_markers_contour(
        image, sheet_to_marker_width_ratio=sheet_to_marker_width_ratio
    )
    if contour_result is not None:
        logger.info("Marker crop succeeded (contour-square pass).")
        return contour_result

    # ── Pass 2: Clean template matching (no erode-subtract) ──
    marker_clean = _load_marker(
        marker_path, processing_width, sheet_to_marker_width_ratio,
        apply_erode_subtract=False,
    )
    image_norm = remove_shadows(image, blur_sigma=27)
    result = _match_markers_in_quadrants(
        image, image_norm, marker_clean, **match_args,
    )
    if result is not None:
        logger.info("Marker crop succeeded (template-clean pass).")
        return result

    # ── Pass 3: Erode-subtract on both marker and image ──
    logger.info("Template-clean pass failed — trying erode-subtract pass.")
    marker_eroded = _load_marker(
        marker_path, processing_width, sheet_to_marker_width_ratio,
        apply_erode_subtract=True,
    )
    eroded_img = cv2.erode(
        image, kernel=np.ones(EROSION_KERNEL_SIZE), iterations=EROSION_ITERATIONS,
    )
    image_erode_sub = normalize_image(cv2.subtract(image, eroded_img))
    result = _match_markers_in_quadrants(
        image, image_erode_sub, marker_eroded, **match_args,
    )
    if result is not None:
        logger.info("Marker crop succeeded (erode-subtract pass).")
        return result

    logger.warning("Both marker matching passes failed — no markers detected.")
    return None


# ═══════════════════════════════════════════════════════════════════
#  Fallback: contour-based page crop
# ═══════════════════════════════════════════════════════════════════

def auto_detect_and_crop_page(img: np.ndarray) -> np.ndarray:
    """
    Fallback page-boundary detection using contours.
    Used only when marker-based crop is not possible.
    """
    try:
        h, w = img.shape[:2]
        target_ratio = 1700.0 / 2600.0  # sample7 page ratio (width/height)

        work = remove_shadows(img, blur_sigma=25)
        blurred = cv2.GaussianBlur(work, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return img

        image_area = float(h * w)
        best_pts = None
        best_score = -1e9

        # Evaluate multiple candidates instead of blindly taking the largest contour.
        for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:25]:
            area = float(cv2.contourArea(cnt))
            if area < image_area * 0.08:
                continue

            peri = cv2.arcLength(cnt, True)
            if peri <= 0:
                continue

            approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
            if len(approx) != 4:
                continue

            pts = approx.reshape(4, 2).astype("float32")
            ordered = order_points(pts)
            tl, tr, br, bl = ordered
            width_est = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
            height_est = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
            if width_est < 10 or height_est < 10:
                continue

            ratio = width_est / height_est
            ratio_penalty = abs(ratio - target_ratio)

            # Keep only plausible page ratios (allow perspective and camera distortion)
            if ratio_penalty > 0.35:
                continue

            # Prefer larger contours and better ratio match
            score = area - (ratio_penalty * image_area * 0.15)
            if score > best_score:
                best_score = score
                best_pts = pts

        if best_pts is not None:
            return four_point_transform(img, best_pts)

        return img
    except Exception:
        return img


# ═══════════════════════════════════════════════════════════════════
#  High-level preprocessing entry point
# ═══════════════════════════════════════════════════════════════════

def preprocess_omr_image(
    img: np.ndarray,
    marker_path: str | None = None,
    sheet_to_marker_width_ratio: int = 17,
) -> np.ndarray:
    """
    Full preprocessing pipeline:
      1. Try CropOnMarkers (perspective-correct using 4 corner markers).
      2. If that fails, fall back to contour-based page detection.
      3. Normalize the result.
    """
    # Try marker-based crop first
    cropped = crop_on_markers(
        img,
        marker_path=marker_path,
        sheet_to_marker_width_ratio=sheet_to_marker_width_ratio,
    )
    if cropped is not None:
        logger.info("Marker-based crop succeeded.")
        # Keep detection image close to original intensity profile.
        # Strong shadow flattening here can wash out faint marks.
        return normalize_image(cropped)

    # Fall back to contour detection
    logger.info("Marker crop failed — falling back to contour-based page detection.")
    cropped = auto_detect_and_crop_page(img)
    return normalize_image(cropped)
