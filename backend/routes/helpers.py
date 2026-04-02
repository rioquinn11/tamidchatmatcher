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

# Must match combined.tamid_class exactly for current Alef education cohort.
ALEF_2026_CLASS_LABEL = "Alef (Spring 2026)"


def should_hide_alef_2026_classmate(viewer_class, candidate_class) -> bool:
    v = (viewer_class or "").strip()
    c = (candidate_class or "").strip()
    return v == ALEF_2026_CLASS_LABEL and c == ALEF_2026_CLASS_LABEL


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
    return sum((x * y) for x, y in zip(a, b))


def parse_embedding(raw):
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


def parse_csv_emails(text) -> set[str]:
    """Lowercase emails from a comma-separated user_state column."""
    if not text:
        return set()
    return {e.strip().lower() for e in str(text).split(",") if e.strip()}


def excluded_emails_from_user_state_row(row: dict | None) -> set[str]:
    """People the viewer should not see in matches: not_interested ∪ pending ∪ completed."""
    if not row:
        return set()
    out: set[str] = set()
    for key in ("not_interested", "pending", "completed"):
        out |= parse_csv_emails(row.get(key))
    return out


def is_graduated_truthy(row: dict) -> bool:
    """Aligned with embedder/embed_professional.py — truthy means exclude from matching pool."""
    v = row.get("is_graduated")
    if v is True or v == 1:
        return True
    if isinstance(v, str) and v.strip().lower() in ("true", "t", "1", "yes"):
        return True
    return False


def is_active_explicitly_false(row: dict) -> bool:
    """Exclude when is_active is explicitly false; None/unknown stays eligible."""
    v = row.get("is_active")
    if v is False or v == 0:
        return True
    if isinstance(v, str) and v.strip().lower() in ("false", "f", "0", "no", "n"):
        return True
    return False


def should_exclude_from_match_pool(row: dict) -> bool:
    return is_graduated_truthy(row) or is_active_explicitly_false(row)
