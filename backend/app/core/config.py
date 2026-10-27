class Settings:
    PROJECT_NAME: str = "Mobility Impaired Navigation"
    DEFAULT_LOCATION: str = "Buk-gu, Gwangju, South Korea"
    ROUTE_REGION_LABEL: str = "광주광역시 북구"
    
    STAIRS_IMPASSABLE: float = 999999.0
    STAIRS_HIGH_PENALTY: float = 10.0
    STAIRS_MID_PENALTY: float = 2.0
    
    NON_TACTILE_PENALTY: float = 5.0
    UNPAVED_SURFACE_PENALTY: float = 3.0

settings = Settings()
