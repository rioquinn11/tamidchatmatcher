import os
import json
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY") or ""
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

PAGE_SIZE = 500

DISPLAY_COLUMNS = [
    "name",
    "birthday",
    "grad_year",
    "major",
    "minor",
    "phone_number",
    "hometown",
    "location",
    "industry",
    "company_name",
    "coop_name",
    "tamid_class",
    "tamid_position",
    "track_involvement",
    "e_board_positions",
    "instagram",
    "linkedin",
    "northeastern_email",
]


def dot_product(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def parse_embedding(raw):
    if isinstance(raw, str):
        return json.loads(raw)
    return raw
