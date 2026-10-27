import unittest
from app.services.weight_calculator import weight_calculator

class TestWeightCalculator(unittest.TestCase):
    def test_wheelchair_stairs_blocking(self):
        edge = {"highway": "steps", "length": 10.0}
        weight = weight_calculator.calculate_edge_weight(1, 2, 0, edge, "wheelchair", False)
        self.assertGreaterEqual(weight, 999999.0)

    def test_visually_impaired_tactile_penalty(self):
        edge = {"highway": "footway", "tactile_paving": "no", "length": 10.0}
        weight_with_priority = weight_calculator.calculate_edge_weight(1, 2, 0, edge, "visually_impaired", True)
        weight_without_priority = weight_calculator.calculate_edge_weight(1, 2, 0, edge, "visually_impaired", False)
        self.assertGreater(weight_with_priority, weight_without_priority)

if __name__ == "__main__":
    unittest.main()
