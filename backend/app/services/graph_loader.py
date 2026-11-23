import os
import osmnx as ox
from app.core.config import settings
from app.services.weight_calculator import weight_calculator

class GraphLoader:
    def __init__(self):
        self.G = None
        self.graphs = {}
        self.status = "not_started"
        self.region_status = {}
        self.data_dir = os.path.join(os.path.dirname(__file__), "../../data")
        self.cache_file = os.path.join(self.data_dir, "map_cache.graphml")

    def load_graph(self):
        self.status = "loading"
        self.graphs = {}
        self.region_status = {}
        self.G = None
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            ox.settings.overpass_url = "https://overpass.kumi.systems/api/interpreter"
            ox.settings.timeout = 180
            ox.settings.useful_tags_way = list(dict.fromkeys([
                *ox.settings.useful_tags_way,
                "foot", "wheelchair", "surface", "smoothness", "tactile_paving",
                "incline", "crossing", "sidewalk", "lit", "sac_scale",
            ]))
            failures = []
            for region_id, region in settings.ROUTE_REGIONS.items():
                cache_file = os.path.join(self.data_dir, region["cache_file"])
                try:
                    if os.path.exists(cache_file):
                        print(f"[GraphLoader] {region['label']} 지도 캐시 로드: {cache_file}", flush=True)
                        graph = ox.load_graphml(cache_file)
                    else:
                        print(
                            f"[GraphLoader] OpenStreetMap에서 {region['label']} 보행 지도 다운로드 중...",
                            flush=True
                        )
                        graph = ox.graph_from_point(
                            (region["latitude"], region["longitude"]),
                            dist=region["radius_m"],
                            network_type="walk"
                        )
                        ox.save_graphml(graph, cache_file)

                    weight_calculator.prepare_graph(graph)
                    self.graphs[region_id] = graph
                    self.region_status[region_id] = "ready"
                    if region_id == "busan":
                        self.G = graph
                    print(
                        f"[GraphLoader] {region['label']} 지도 준비 완료: "
                        f"{len(graph.nodes):,}개 노드, {len(graph.edges):,}개 도로",
                        flush=True
                    )
                except Exception as error:
                    self.region_status[region_id] = "failed"
                    failures.append((region["label"], error))
                    print(
                        f"[GraphLoader] {region['label']} 지도 준비 실패: {error}",
                        flush=True
                    )

            if not self.graphs:
                self.status = "failed"
                details = "; ".join(f"{label}: {error}" for label, error in failures)
                raise RuntimeError(f"지도 데이터를 불러오지 못했습니다. {details}")

            self.status = "ready" if not failures else "partial"
            return self.G
        except Exception:
            if self.status != "failed":
                self.status = "failed"
            raise

    def get_graph(self, region_id):
        graph = self.graphs.get(region_id)
        if graph is not None:
            return graph
        if region_id == "busan" and self.G is not None:
            return self.G
        if self.status == "loading":
            raise RuntimeError("지도 데이터를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.")
        if self.region_status.get(region_id) == "failed":
            region_label = settings.ROUTE_REGIONS[region_id]["label"]
            raise RuntimeError(f"{region_label} 지도 데이터를 불러오지 못했습니다.")
        raise RuntimeError("지도 데이터를 불러오지 못했습니다. 서버 로그를 확인해 주세요.")

graph_loader = GraphLoader()
