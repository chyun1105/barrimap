class Settings:
    PROJECT_NAME: str = "Mobility Impaired Navigation"
    DEFAULT_LOCATION: str = "서울대학교 관악캠퍼스 주변"
    DEFAULT_LATITUDE: float = 37.4599
    DEFAULT_LONGITUDE: float = 126.9519
    DEFAULT_DIST: int = 3000
    ROUTE_REGION_LABEL: str = "서울대 관악캠퍼스 주변"
    
    STAIRS_IMPASSABLE: float = 999999.0
    STAIRS_HIGH_PENALTY: float = 10.0
    STAIRS_MID_PENALTY: float = 2.0
    
    NON_TACTILE_PENALTY: float = 5.0
    UNPAVED_SURFACE_PENALTY: float = 3.0

settings = Settings()
