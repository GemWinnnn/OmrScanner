"""
Evaluator: scores OMR responses against an answer key.
"""

from __future__ import annotations

from app.models.schemas import BubbleResult, MarkingScheme


def evaluate_response(
    omr_response: dict[str, str],
    answer_key: dict[str, str],
    marking_scheme: MarkingScheme | None = None,
    bubble_intensities: dict[str, list[float]] | None = None,
) -> tuple[float, int, list[BubbleResult]]:
    """
    Evaluate detected answers against the answer key.

    Returns:
        (score, total_questions, bubble_details)
    """
    if marking_scheme is None:
        marking_scheme = MarkingScheme()

    score = 0.0
    total = len(answer_key)
    details: list[BubbleResult] = []

    for question, correct_answer in answer_key.items():
        marked = omr_response.get(question, "")
        intensities = (bubble_intensities or {}).get(question, [])

        if not marked or marked == "":
            # Unmarked
            is_correct = None
            score += marking_scheme.unmarked
        elif marked.upper() == correct_answer.upper():
            is_correct = True
            score += marking_scheme.correct
        else:
            is_correct = False
            score += marking_scheme.incorrect

        details.append(
            BubbleResult(
                question=question,
                marked=marked if marked else "(unmarked)",
                correct=correct_answer,
                is_correct=is_correct,
                intensity_values=intensities,
            )
        )

    # Sort details by question number
    def sort_key(b: BubbleResult) -> int:
        num = "".join(c for c in b.question if c.isdigit())
        return int(num) if num else 0

    details.sort(key=sort_key)

    return score, total, details
