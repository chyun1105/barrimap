from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api.v1.route import router as route_router
from app.services.graph_loader import graph_loader

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
    print("[System] OSMnx 지도 데이터 로딩 시작...")
    graph_loader.load_graph()
    print("[System] 서버 준비 완료!")

@app.get("/")
def root():
    return {"message": "Barrier-Free Navigation API is running."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
