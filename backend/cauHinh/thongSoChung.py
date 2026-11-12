import os

CARBON_API_BASE_URL = os.getenv("CARBON_API_BASE_URL", "https://api.carbonintensity.org.uk").rstrip("/")
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "khoLuuMoHinh")
DEFAULT_HISTORY_LIMIT = 48
FORECAST_HORIZON = 48
COLLECTION_INTERVAL_SECONDS = int(os.getenv("COLLECTION_INTERVAL_SECONDS", "1800"))
