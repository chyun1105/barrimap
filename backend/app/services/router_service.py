import osmnx as ox
import networkx as nx
from geopy.distance import geodesic
from shapely import wkt
from app.core.config import settings
from app.services.graph_loader import graph_loader
from app.services.weight_calculator import weight_calculator
from app.models.schemas import RouteRequest, RouteResponse, RouteDetail, TactileSegment

class RouterService:
    @staticmethod
    def _edge_coordinates(graph, start, end, edge):
        geometry = edge.get("geometry")
        if isinstance(geometry, str):
            geometry = wkt.loads(geometry)

        if geometry is not None and hasattr(geometry, "coords"):
            coordinates = list(geometry.coords)
            start_xy = (graph.nodes[start]["x"], graph.nodes[start]["y"])
            if coordinates and geodesic(
                (coordinates[0][1], coordinates[0][0]),
                (start_xy[1], start_xy[0])
            ).meters > 2:
                coordinates.reverse()
        else:
            coordinates = [
                (graph.nodes[start]["x"], graph.nodes[start]["y"]),
                (graph.nodes[end]["x"], graph.nodes[end]["y"]),
            ]

        return [[float(latitude), float(longitude)] for longitude, latitude, *_ in coordinates]

    def _route_detail(self, graph, path, user_type, tactile_priority, accessible):
        coordinates = []
        tactile_segments = []
        distance = 0.0
        stairs_count = 0
        tactile_counts = {"yes": 0, "no": 0, "unknown": 0}
        grade_values = []

        for start, end in zip(path, path[1:]):
            edge_options = graph.get_edge_data(start, end)
            _, edge = min(
                edge_options.items(),
                key=lambda item: (
                    weight_calculator.calculate_edge_weight(
                        start, end, item[0], item[1], user_type, tactile_priority
                    )
                    if accessible
                    else float(item[1].get("length", 1.0))
                )
            )
            edge_coordinates = self._edge_coordinates(graph, start, end, edge)
            if coordinates and edge_coordinates and coordinates[-1] == edge_coordinates[0]:
                coordinates.extend(edge_coordinates[1:])
            else:
                coordinates.extend(edge_coordinates)

            tactile_status = weight_calculator.tactile_status(edge)
            grade_percent = weight_calculator.grade_percent(edge)
            tactile_counts[tactile_status] += 1
            grade_values.append(grade_percent)
            distance += float(edge.get("length", 0))

            highway = edge.get("highway", "")
            highway_values = highway if isinstance(highway, list) else [highway]
            if any("steps" in str(value) for value in highway_values):
                stairs_count += 1

            tactile_segments.append(TactileSegment(
                coordinates=edge_coordinates,
                tactile_status=tactile_status,
                grade_percent=round(grade_percent, 1)
            ))

        max_grade = max(grade_values, default=0.0)
        return RouteDetail(
            coordinates=coordinates,
            distance_m=round(distance, 1),
            stairs_count=stairs_count,
            non_tactile_count=tactile_counts["no"] + tactile_counts["unknown"],
            tactile_yes_count=tactile_counts["yes"],
            tactile_no_count=tactile_counts["no"],
            tactile_unknown_count=tactile_counts["unknown"],
            steep_segments_count=sum(
                grade >= settings.STEEP_GRADE_THRESHOLD_PERCENT for grade in grade_values
            ),
            max_grade_percent=round(max_grade, 1),
            tactile_segments=tactile_segments
        )

    def calculate_route(self, req: RouteRequest) -> RouteResponse:
        G = graph_loader.G
        if G is None:
            if graph_loader.status == "failed":
                raise RuntimeError("지도 데이터를 불러오지 못했습니다. 서버 로그를 확인해 주세요.")
            raise RuntimeError("지도 데이터를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.")

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
                    f"{label}가 현재 경로 데이터 범위({settings.ROUTE_REGION_LABEL}) 밖에 있습니다. "
                    f"{settings.ROUTE_REGION_LABEL} 안의 장소를 선택해 주세요."
                )

        try:
            std_path = nx.shortest_path(G, orig_node, dest_node, weight="length")
        except nx.NetworkXNoPath:
            raise ValueError("일반 최단 경로를 찾을 수 없습니다.")

        def custom_weight(u, v, edge_options):
            return min(
                weight_calculator.calculate_edge_weight(
                    u, v, key, data, req.user_type, req.tactile_priority
                )
                for key, data in edge_options.items()
            )
        try:
            acc_path = nx.shortest_path(
                G,
                orig_node,
                dest_node,
                weight=custom_weight
            )
        except nx.NetworkXNoPath:
            acc_path = std_path

        std_route = self._route_detail(
            G, std_path, req.user_type, req.tactile_priority, accessible=False
        )
        acc_route = self._route_detail(
            G, acc_path, req.user_type, req.tactile_priority, accessible=True
        )

        warnings = []
        if req.user_type == "visually_impaired" and req.tactile_priority:
            if acc_route.tactile_no_count:
                warnings.append(
                    f"경로에 점자블록 없음으로 표시된 구간이 "
                    f"{acc_route.tactile_no_count}곳 포함되어 있습니다."
                )
            if acc_route.tactile_unknown_count:
                warnings.append(
                    f"점자블록 정보가 확인되지 않는 구간이 "
                    f"{acc_route.tactile_unknown_count}곳 있습니다. 미설치라는 뜻은 아닙니다."
                )
        if req.user_type == "wheelchair" and std_route.stairs_count > 0 and acc_route.stairs_count == 0:
            warnings.append("일반 경로의 계단 구간을 회피하여 안전한 우회로로 안내합니다.")

        return RouteResponse(
            status="success",
            standard_route=std_route,
            accessible_route=acc_route,
            warnings=warnings
        )

router_service = RouterService()
