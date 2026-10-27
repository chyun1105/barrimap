from app.core.config import settings

class WeightCalculator:
    @staticmethod
    def calculate_edge_weight(u, v, k, edge, user_type: str, tactile_priority: bool) -> float:
        length = edge.get("length", 1.0)
        highway = edge.get("highway", "")
        incline = edge.get("incline", 0)
        tactile = edge.get("tactile_paving", "no")
        surface = edge.get("surface", "")

        is_stairs = highway == "steps" or "steps" in str(highway)
        penalty = 1.0

        if user_type == "wheelchair":
            if is_stairs:
                return settings.STAIRS_IMPASSABLE
            
            if isinstance(incline, (int, float)) and incline > 5:
                penalty += (incline - 5) * 2.0
            elif str(incline).replace('-', '').isdigit():
                inc_val = abs(float(incline))
                if inc_val > 5:
                    penalty += (inc_val - 5) * 2.0

            if surface in ["unpaved", "cobblestone", "gravel"]:
                penalty += settings.UNPAVED_SURFACE_PENALTY

        elif user_type == "visually_impaired":
            if tactile_priority and tactile != "yes":
                penalty += settings.NON_TACTILE_PENALTY
            if is_stairs:
                penalty += settings.STAIRS_MID_PENALTY

        elif user_type == "mobility_impaired":
            if is_stairs:
                penalty += settings.STAIRS_HIGH_PENALTY
            if isinstance(incline, (int, float)) and abs(incline) > 5:
                penalty += 3.0

        return length * penalty

weight_calculator = WeightCalculator()
