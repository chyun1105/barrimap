import os
import osmnx as ox
from app.core.config import settings

class GraphLoader:
    def __init__(self):
        self.G = None
        self.data_dir = os.path.join(os.path.dirname(__file__), "../../data")
        self.cache_file = os.path.join(self.data_dir, "map_cache.graphml")

    def load_graph(self):
        os.makedirs(self.data_dir, exist_ok=True)
        if os.path.exists(self.cache_file):
            print(f"[GraphLoader] 캐시된 지도 파일 로드: {self.cache_file}")
            self.G = ox.load_graphml(self.cache_file)
        else:
            print(f"[GraphLoader] OpenStreetMap에서 지도 다운로드 중 ({settings.DEFAULT_LOCATION})...")
            self.G = ox.graph_from_address(
                settings.DEFAULT_LOCATION,
                dist=settings.DEFAULT_DIST,
                network_type="walk"
            )
            ox.save_graphml(self.G, self.cache_file)
            print("[GraphLoader] 지도 캐시 저장 완료!")
        return self.G

graph_loader = GraphLoader()
