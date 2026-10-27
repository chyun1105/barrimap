class Settings:
    PROJECT_NAME: str = "Mobility Impaired Navigation"
    DEFAULT_LOCATION: str = "Sinchon-dong, Seodaemun-gu, Seoul, South Korea"
    DEFAULT_DIST: int = 1500
    
    STAIRS_IMPASSABLE: float = 999999.0
    STAIRS_HIGH_PENALTY: float = 10.0
    STAIRS_MID_PENALTY: float = 2.0
    
    NON_TACTILE_PENALTY: float = 5.0
    UNPAVED_SURFACE_PENALTY: float = 3.0

settings = Settings()
