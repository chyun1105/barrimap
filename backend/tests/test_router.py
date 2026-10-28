import unittest
from unittest.mock import patch
import networkx as nx

from app.models.schemas import RouteRequest
from app.services.graph_loader import graph_loader
from app.services.router_service import RouterService
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

    def test_tactile_unknown_is_distinct_from_no(self):
        unknown = {"highway": "footway", "length": 10.0}
        missing = {"highway": "footway", "tactile_paving": "no", "length": 10.0}
        unknown_weight = weight_calculator.calculate_edge_weight(
            1, 2, 0, unknown, "visually_impaired", True
        )
        missing_weight = weight_calculator.calculate_edge_weight(
            1, 2, 0, missing, "visually_impaired", True
        )

        self.assertEqual(weight_calculator.tactile_status(unknown), "unknown")
        self.assertLess(unknown_weight, missing_weight)

    def test_wheelchair_grade_penalty_uses_elevation_derived_grade(self):
        flat = {"highway": "footway", "length": 100.0, "grade_abs": 0.03}
        steep = {"highway": "footway", "length": 100.0, "grade_abs": 0.10}

        flat_weight = weight_calculator.calculate_edge_weight(1, 2, 0, flat, "wheelchair", False)
        steep_weight = weight_calculator.calculate_edge_weight(1, 2, 0, steep, "wheelchair", False)

        self.assertEqual(flat_weight, 100.0)
        self.assertGreater(steep_weight, flat_weight)

    def test_mobility_grade_penalty_uses_elevation_derived_grade(self):
        flat = {"highway": "footway", "length": 100.0, "grade_abs": 0.02}
        steep = {"highway": "footway", "length": 100.0, "grade_abs": 0.10}

        flat_weight = weight_calculator.calculate_edge_weight(1, 2, 0, flat, "mobility_impaired", False)
        steep_weight = weight_calculator.calculate_edge_weight(1, 2, 0, steep, "mobility_impaired", False)

        self.assertEqual(flat_weight, 100.0)
        self.assertGreater(steep_weight, flat_weight)

class TestRouterService(unittest.TestCase):
    def test_wheelchair_route_prefers_flatter_alternative_and_returns_segments(self):
        graph = nx.MultiDiGraph()
        graph.graph["crs"] = "EPSG:4326"
        graph.add_node(1, x=129.0354, y=35.1159)
        graph.add_node(2, x=129.0364, y=35.1159)
        graph.add_node(3, x=129.0374, y=35.1159)
        graph.add_edge(1, 3, length=220.0, highway="footway", grade_abs=0.10, tactile_paving="yes")
        graph.add_edge(1, 2, length=120.0, highway="footway", grade_abs=0.01, tactile_paving="yes")
        graph.add_edge(2, 3, length=120.0, highway="footway", grade_abs=0.01)
        request = RouteRequest(
            start_lat=35.1159,
            start_lon=129.0354,
            end_lat=35.1159,
            end_lon=129.0374,
            user_type="wheelchair",
            tactile_priority=False,
        )

        with patch.object(graph_loader, "G", graph), patch.object(graph_loader, "status", "ready"):
            result = RouterService().calculate_route(request)

        self.assertEqual(result.status, "success")
        self.assertEqual(result.standard_route.distance_m, 220.0)
        self.assertEqual(result.accessible_route.distance_m, 240.0)
        self.assertEqual(result.accessible_route.max_grade_percent, 1.0)
        self.assertEqual(result.accessible_route.tactile_yes_count, 1)
        self.assertEqual(result.accessible_route.tactile_unknown_count, 1)
        self.assertEqual(len(result.accessible_route.tactile_segments), 2)

if __name__ == "__main__":
    unittest.main()
