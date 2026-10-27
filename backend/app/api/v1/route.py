from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import RouteRequest, RouteResponse
from app.services.router_service import router_service

router = APIRouter()

@router.get("/route", response_model=RouteResponse)
def get_custom_route(
    start_lat: float = Query(..., description="출발지 위도"),
    start_lon: float = Query(..., description="출발지 경도"),
    end_lat: float = Query(..., description="목적지 위도"),
    end_lon: float = Query(..., description="목적지 경도"),
    user_type: str = Query("wheelchair", description="교통약자 유형: wheelchair | visually_impaired | mobility_impaired"),
    tactile_priority: bool = Query(False, description="시각장애인 점자블록 우선 설정 여부")
):
    try:
        req = RouteRequest(
            start_lat=start_lat,
            start_lon=start_lon,
            end_lat=end_lat,
            end_lon=end_lon,
            user_type=user_type,
            tactile_priority=tactile_priority
        )
        return router_service.calculate_route(req)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"경로 탐색 중 오류 발생: {str(e)}")
