from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class RouteRequest(BaseModel):
    start_lat: float = Field(..., example=35.1159)
    start_lon: float = Field(..., example=129.0354)
    end_lat: float = Field(..., example=35.1180)
    end_lon: float = Field(..., example=129.0380)
    user_type: str = Field("wheelchair", description="wheelchair | visually_impaired | mobility_impaired")
    tactile_priority: bool = Field(False)

class TactileSegment(BaseModel):
    coordinates: List[List[float]]
    tactile_status: Literal["yes", "no", "unknown"]
    grade_percent: float = 0

class RouteDetail(BaseModel):
    coordinates: List[List[float]]
    distance_m: float
    stairs_count: int
    non_tactile_count: Optional[int] = 0
    tactile_yes_count: int = 0
    tactile_no_count: int = 0
    tactile_unknown_count: int = 0
    steep_segments_count: int = 0
    max_grade_percent: float = 0
    tactile_segments: List[TactileSegment] = Field(default_factory=list)

class RouteResponse(BaseModel):
    status: str
    standard_route: RouteDetail
    accessible_route: RouteDetail
    warnings: List[str]
