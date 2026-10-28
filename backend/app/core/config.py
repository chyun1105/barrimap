class Settings:
    PROJECT_NAME: str = "Mobility Impaired Navigation"
    DEFAULT_LOCATION: str = "부산 초량·산복도로"
    DEFAULT_LATITUDE: float = 35.1159
    DEFAULT_LONGITUDE: float = 129.0354
    DEFAULT_DIST: int = 3000
    ROUTE_REGION_LABEL: str = "부산 초량·산복도로 주변"
    
    STAIRS_IMPASSABLE: float = 999999.0
    STAIRS_HIGH_PENALTY: float = 10.0
    STAIRS_MID_PENALTY: float = 2.0
    
    NON_TACTILE_PENALTY: float = 5.0
    UNKNOWN_TACTILE_PENALTY: float = 2.0
    UNPAVED_SURFACE_PENALTY: float = 3.0
    WHEELCHAIR_GRADE_THRESHOLD_PERCENT: float = 5.0
    WHEELCHAIR_GRADE_PENALTY_PER_PERCENT: float = 1.5
    MOBILITY_GRADE_THRESHOLD_PERCENT: float = 3.0
    MOBILITY_GRADE_PENALTY_PER_PERCENT: float = 0.75
    STEEP_GRADE_THRESHOLD_PERCENT: float = 8.0

settings = Settings()
