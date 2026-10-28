import math
import re

from app.core.config import settings

class WeightCalculator:
    @staticmethod
    def tactile_status(edge) -> str:
        value = edge.get("tactile_paving")
        values = value if isinstance(value, list) else [value]
        normalized = {str(item).strip().lower() for item in values if item is not None}
        if "yes" in normalized:
            return "yes"
        if "no" in normalized:
            return "no"
        return "unknown"

    @staticmethod
    def grade_percent(edge) -> float:
        grade = edge.get("grade_abs")
        if isinstance(grade, (int, float)) and math.isfinite(grade):
            return abs(float(grade)) * 100

        incline = edge.get("incline")
        values = incline if isinstance(incline, list) else [incline]
        for value in values:
            if value is None:
                continue
            match = re.search(r"[-+]?\d+(?:\.\d+)?", str(value))
            if match:
                incline_percent = abs(float(match.group()))
                return 100 * math.tan(math.radians(incline_percent)) if "°" in str(value) else incline_percent
        return 0.0

    @staticmethod
    def calculate_edge_weight(u, v, k, edge, user_type: str, tactile_priority: bool) -> float:
        length = edge.get("length", 1.0)
        highway = edge.get("highway", "")
        grade_percent = WeightCalculator.grade_percent(edge)
        tactile_status = WeightCalculator.tactile_status(edge)
        surface = edge.get("surface", "")

        highway_values = highway if isinstance(highway, list) else [highway]
        is_stairs = any("steps" in str(value) for value in highway_values)
        penalty = 1.0

        if user_type == "wheelchair":
            if is_stairs:
                return settings.STAIRS_IMPASSABLE

            if grade_percent > settings.WHEELCHAIR_GRADE_THRESHOLD_PERCENT:
                penalty += (
                    grade_percent - settings.WHEELCHAIR_GRADE_THRESHOLD_PERCENT
                ) * settings.WHEELCHAIR_GRADE_PENALTY_PER_PERCENT

            if surface in ["unpaved", "cobblestone", "gravel"]:
                penalty += settings.UNPAVED_SURFACE_PENALTY

        elif user_type == "visually_impaired":
            if tactile_priority:
                if tactile_status == "no":
                    penalty += settings.NON_TACTILE_PENALTY
                elif tactile_status == "unknown":
                    penalty += settings.UNKNOWN_TACTILE_PENALTY
            if is_stairs:
                penalty += settings.STAIRS_MID_PENALTY

        elif user_type == "mobility_impaired":
            if is_stairs:
                penalty += settings.STAIRS_HIGH_PENALTY
            if grade_percent > settings.MOBILITY_GRADE_THRESHOLD_PERCENT:
                penalty += (
                    grade_percent - settings.MOBILITY_GRADE_THRESHOLD_PERCENT
                ) * settings.MOBILITY_GRADE_PENALTY_PER_PERCENT

        return length * penalty

weight_calculator = WeightCalculator()
