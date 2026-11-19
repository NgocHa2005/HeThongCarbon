import os

CARBON_API_BASE_URL = os.getenv("CARBON_API_BASE_URL", "https://api.carbonintensity.org.uk").rstrip("/")
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "khoLuuMoHinh")
DEFAULT_HISTORY_LIMIT = 48
FORECAST_HORIZON = 48
GLOBAL_REGION_ID = 0
GLOBAL_REGION_SHORT_NAME = "GB"
GLOBAL_REGION_FULL_NAME = "Great Britain (National)"
CARBON_ALERT_THRESHOLD = int(os.getenv("CARBON_ALERT_THRESHOLD", "250"))
CARBON_ALERT_CHANGE_PERCENT = float(os.getenv("CARBON_ALERT_CHANGE_PERCENT", "30"))
CARBON_ALERT_WINDOW_HOURS = int(os.getenv("CARBON_ALERT_WINDOW_HOURS", "24"))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
