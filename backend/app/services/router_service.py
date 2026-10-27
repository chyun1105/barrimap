import osmnx as ox
import networkx as nx
from geopy.distance import geodesic
from app.services.graph_loader import graph_loader
from app.services.weight_calculator import weight_calculator
from app.models.schemas import RouteRequest, RouteResponse, RouteDetail

class RouterService:
    def calculate_route(self, req: RouteRequest) -> RouteResponse:
        G = graph_loader.G
        if G is None:
            raise RuntimeError("Map graph is not loaded")

        orig_node = ox.distance.nearest_nodes(G, req.start_lon, req.start_lat)
        dest_node = ox.distance.nearest_nodes(G, req.end_lon, req.end_lat)

        for label, node, lat, lon in (
            ("출발지", orig_node, req.start_lat, req.start_lon),
            ("도착지", dest_node, req.end_lat, req.end_lon),
        ):
            nearest_node = G.nodes[node]
            distance_m = geodesic(
                (lat, lon),
                (nearest_node["y"], nearest_node["x"])
            ).meters
            if distance_m > 300:
                raise ValueError(
                    f"{label}가 현재 경로 데이터 범위(신촌 주변) 밖에 있습니다. "
                    "신촌 인근 장소를 선택해 주세요."
                )

        try:
            std_path = nx.shortest_path(G, orig_node, dest_node, weight="length")
        except nx.NetworkXNoPath:
            raise ValueError("일반 최단 경로를 찾을 수 없습니다.")

        G_custom = G.copy()
        for u, v, k, data in G_custom.edges(keys=True, data=True):
            G_custom[u][v][k]["custom_weight"] = weight_calculator.calculate_edge_weight(
                u, v, k, data, req.user_type, req.tactile_priority
            )

        try:
            acc_path = nx.shortest_path(G_custom, orig_node, dest_node, weight="custom_weight")
        except nx.NetworkXNoPath:
            acc_path = std_path

        def extract_coords(path):
            return [[G.nodes[n]['y'], G.nodes[n]['x']] for n in path]

        def calculate_stats(path):
            total_dist = 0
            stairs_count = 0
            non_tactile_count = 0
            for i in range(len(path) - 1):
                u, v = path[i], path[i+1]
                edge = G.get_edge_data(u, v)[0]
                total_dist += edge.get("length", 0)
                if edge.get("highway") == "steps":
                    stairs_count += 1
                if edge.get("tactile_paving") != "yes":
                    non_tactile_count += 1
            return round(total_dist, 1), stairs_count, non_tactile_count

        std_dist, std_stairs, _ = calculate_stats(std_path)
        acc_dist, acc_stairs, acc_non_tactile = calculate_stats(acc_path)

        warnings = []
        if req.user_type == "visually_impaired" and req.tactile_priority and acc_non_tactile > 0:
            warnings.append(f"경로 중 점자블록 미설치 구간이 {acc_non_tactile}곳 포함되어 있습니다.")
        if req.user_type == "wheelchair" and std_stairs > 0 and acc_stairs == 0:
            warnings.append("일반 경로의 계단 구간을 회피하여 안전한 우회로로 안내합니다.")

        return RouteResponse(
            status="success",
            standard_route=RouteDetail(
                coordinates=extract_coords(std_path),
                distance_m=std_dist,
                stairs_count=std_stairs
            ),
            accessible_route=RouteDetail(
                coordinates=extract_coords(acc_path),
                distance_m=acc_dist,
                stairs_count=acc_stairs,
                non_tactile_count=acc_non_tactile
            ),
            warnings=warnings
        )

router_service = RouterService()
