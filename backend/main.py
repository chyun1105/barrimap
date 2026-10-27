from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import threading
import uvicorn

from app.api.v1.route import router as route_router
from app.services.graph_loader import graph_loader

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Mobility Impaired Navigation API",
    description="교통약자 맞춤형 경로 탐색 백엔드 API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(route_router, prefix="/api/v1")

@app.on_event("startup")
def startup_event():
    print("[System] 서버를 먼저 시작하고 OSMnx 지도 데이터를 백그라운드에서 불러옵니다.", flush=True)

    def load_graph():
        try:
            graph_loader.load_graph()
        except Exception:
            logger.exception("[System] 지도 데이터를 불러오지 못했습니다.")

    threading.Thread(target=load_graph, name="map-graph-loader", daemon=True).start()

@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
def root():
    return {
        "message": "Barrier-Free Navigation API is running.",
        "map_data_status": graph_loader.status
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "map_data_status": graph_loader.status
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
