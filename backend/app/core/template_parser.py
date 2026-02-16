"""
Template parser: converts template JSON config into internal bubble grid structures.
Ported from OMRChecker/src/template.py
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.models.schemas import FIELD_TYPES


@dataclass
class Bubble:
    """A single bubble on the OMR sheet."""
    x: int
    y: int
    field_label: str
    field_value: str


@dataclass
class FieldBlock:
    """A block of fields (e.g. one column of questions)."""
    name: str
    origin: list[int]
    bubble_dimensions: list[int]
    dimensions: list[int] = field(default_factory=list)
    traverse_bubbles: list[list[Bubble]] = field(default_factory=list)
    shift: int = 0
    empty_val: str = ""

    @classmethod
    def from_config(
        cls,
        block_name: str,
        block_config: dict[str, Any],
        global_bubble_dims: list[int],
        global_empty_val: str = "",
    ) -> "FieldBlock":
        """Create a FieldBlock from a config dict."""

        # Merge in field type defaults
        config = {**block_config}
        if "fieldType" in config and config["fieldType"] in FIELD_TYPES:
            config = {**config, **FIELD_TYPES[config["fieldType"]]}

        direction = config.get("direction", "vertical")
        bubble_dims = config.get("bubbleDimensions", global_bubble_dims)
        bubble_values = config["bubbleValues"]
        bubbles_gap = config["bubblesGap"]
        labels_gap = config["labelsGap"]
        origin = config["origin"]
        field_labels = config["fieldLabels"]
        empty_val = config.get("emptyValue", global_empty_val)

        fb = cls(
            name=block_name,
            origin=[int(o) for o in origin],
            bubble_dimensions=[int(d) for d in bubble_dims],
            empty_val=empty_val,
        )

        fb._calculate_dimensions(
            bubble_dims, bubble_values, bubbles_gap, direction, labels_gap, field_labels
        )
        fb._generate_bubble_grid(
            bubble_values, bubbles_gap, direction, labels_gap, field_labels
        )
        return fb

    def _calculate_dimensions(
        self,
        bubble_dims: list[int],
        bubble_values: list[str],
        bubbles_gap: float,
        direction: str,
        labels_gap: float,
        field_labels: list[str],
    ) -> None:
        _h, _v = (1, 0) if direction == "vertical" else (0, 1)
        values_dimension = int(bubbles_gap * (len(bubble_values) - 1) + bubble_dims[_h])
        fields_dimension = int(labels_gap * (len(field_labels) - 1) + bubble_dims[_v])

        if direction == "vertical":
            self.dimensions = [fields_dimension, values_dimension]
        else:
            self.dimensions = [values_dimension, fields_dimension]

    def _generate_bubble_grid(
        self,
        bubble_values: list[str],
        bubbles_gap: float,
        direction: str,
        labels_gap: float,
        field_labels: list[str],
    ) -> None:
        _h, _v = (1, 0) if direction == "vertical" else (0, 1)
        self.traverse_bubbles = []
        lead_point = [float(self.origin[0]), float(self.origin[1])]

        for field_label in field_labels:
            bubble_point = lead_point.copy()
            field_bubbles = []
            for bubble_value in bubble_values:
                field_bubbles.append(
                    Bubble(
                        x=round(bubble_point[0]),
                        y=round(bubble_point[1]),
                        field_label=field_label,
                        field_value=bubble_value,
                    )
                )
                bubble_point[_h] += bubbles_gap
            self.traverse_bubbles.append(field_bubbles)
            lead_point[_v] += labels_gap


class ParsedTemplate:
    """Fully parsed template with all bubble positions computed."""

    def __init__(self, config: dict[str, Any]):
        self.page_dimensions: list[int] = config.get("pageDimensions", [1700, 2600])
        self.bubble_dimensions: list[int] = config.get("bubbleDimensions", [42, 42])
        self.empty_val: str = config.get("emptyValue", "")
        self.output_columns: list[str] = config.get("outputColumns", [])

        self.field_blocks: list[FieldBlock] = []
        for block_name, block_cfg in config.get("fieldBlocks", {}).items():
            fb = FieldBlock.from_config(
                block_name, block_cfg, self.bubble_dimensions, self.empty_val
            )
            self.field_blocks.append(fb)

        # Auto-fill output columns if not provided
        if not self.output_columns:
            for fb in self.field_blocks:
                for bubble_list in fb.traverse_bubbles:
                    if bubble_list:
                        self.output_columns.append(bubble_list[0].field_label)
