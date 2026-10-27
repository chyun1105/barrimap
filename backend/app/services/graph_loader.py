import os
import osmnx as ox
from app.core.config import settings

class GraphLoader:
    def __init__(self):
        self.G = None
        self.status = "not_started"
        self.data_dir = os.path.join(os.path.dirname(__file__), "../../data")
        self.cache_file = os.path.join(self.data_dir, "map_cache.graphml")

    def load_graph(self):
        self.status = "loading"
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            ox.settings.overpass_url = "https://overpass.kumi.systems/api/interpreter"
            ox.settings.timeout = 180
            ox.settings.useful_tags_way = list(dict.fromkeys([
                *ox.settings.useful_tags_way,
                "foot", "wheelchair", "surface", "smoothness", "tactile_paving",
                "incline", "crossing", "sidewalk", "lit", "sac_scale",
            ]))
            if os.path.exists(self.cache_file):
                print(f"[GraphLoader] 캐시된 지도 파일 로드: {self.cache_file}", flush=True)
                graph = ox.load_graphml(self.cache_file)
            else:
                print(
                    f"[GraphLoader] OpenStreetMap에서 주변 보행 지도 다운로드 중 "
                    f"({settings.DEFAULT_LOCATION})...",
                    flush=True
                )
                graph = ox.graph_from_point(
                    (settings.DEFAULT_LATITUDE, settings.DEFAULT_LONGITUDE),
                    dist=settings.DEFAULT_DIST,
                    network_type="walk"
                )
                ox.save_graphml(graph, self.cache_file)
                print("[GraphLoader] 지도 캐시 저장 완료!", flush=True)

            self.G = graph
            self.status = "ready"
            print(
                f"[GraphLoader] 지도 준비 완료: {len(graph.nodes):,}개 노드, "
                f"{len(graph.edges):,}개 도로",
                flush=True
            )
            return self.G
        except Exception:
            self.status = "failed"
            raise

graph_loader = GraphLoader()
