from pydantic import BaseModel, Field
from typing import List, Optional

class RouteRequest(BaseModel):
    start_lat: float = Field(..., example=37.4599)
    start_lon: float = Field(..., example=126.9519)
    end_lat: float = Field(..., example=37.4630)
    end_lon: float = Field(..., example=126.9480)
    user_type: str = Field("wheelchair", description="wheelchair | visually_impaired | mobility_impaired")
    tactile_priority: bool = Field(False)

class RouteDetail(BaseModel):
    coordinates: List[List[float]]
    distance_m: float
    stairs_count: int
    non_tactile_count: Optional[int] = 0

class RouteResponse(BaseModel):
    status: str
    standard_route: RouteDetail
    accessible_route: RouteDetail
    warnings: List[str]
