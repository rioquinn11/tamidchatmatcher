import json
import os
import re
from typing import Any, Optional

from flask import Blueprint, request, jsonify
from supabase import create_client

from .helpers import SUPABASE_URL, SUPABASE_KEY, PAGE_SIZE

leaderboard_bp = Blueprint("leaderboard", __name__)

USER_STATE_TABLE = os.getenv("USER_STATE_TABLE", "user_state")
OWNER_EMAIL_COL = os.getenv("USER_STATE_OWNER_EMAIL_COL", "northeastern_email")
# Primary column for partner list / count; falls back if that cell is empty.
COMPLETED_LIST_COL = os.getenv("USER_STATE_COMPLETED_LIST_COL", "completed")
_COMPLETED_FALLBACK_COLS = ("completed_chat_emails", "completed_chats")
# Comma-separated keys to read display name from user_state (first non-empty wins)
_NAME_KEYS_RAW = os.getenv("USER_STATE_NAME_COLS", "name,display_name")
NAME_KEYS = [k.strip() for k in _NAME_KEYS_RAW.split(",") if k.strip()]


def _is_nonempty_value(raw: Any) -> bool:
    if raw is None:
        return False
    if isinstance(raw, bool):
        return False
    if isinstance(raw, (int, float)):
        return True
    if isinstance(raw, (list, tuple)):
        return len(raw) > 0
    return bool(str(raw).strip())


def raw_completed_field(row: dict) -> Any:
    """Value from configured column, else first non-empty fallback column."""
    for col in (COMPLETED_LIST_COL, *_COMPLETED_FALLBACK_COLS):
        if not col:
            continue
        v = row.get(col)
        if _is_nonempty_value(v):
            return v
    return None


def count_completed_chats(raw: Any) -> int:
    """Supabase may return text, Postgres text[], json/jsonb, or a numeric counter."""
    if raw is None:
        return 0
    if isinstance(raw, bool):
        return 0
    if isinstance(raw, int):
        return max(0, raw)
    if isinstance(raw, float):
        return max(0, int(raw))
    if isinstance(raw, (list, tuple)):
        return sum(1 for x in raw if x is not None and str(x).strip())

    s = str(raw).strip()
    if not s:
        return 0
    if s.startswith("["):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return sum(1 for x in parsed if x is not None and str(x).strip())
        except json.JSONDecodeError:
            pass
    parts = re.split(r"[,;\n]+", s)
    return len([p for p in parts if p.strip()])


def display_name_from_state_row(row: dict) -> Optional[str]:
    for key in NAME_KEYS:
        v = row.get(key)
        if v is not None and str(v).strip():
            return str(v).strip()
    return None


def load_combined_email_to_name(sb) -> dict[str, str]:
    lookup: dict[str, str] = {}
    offset = 0
    while True:
        resp = (
            sb.table("combined")
            .select("northeastern_email,name")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        rows = resp.data or []
        for r in rows:
            email = str(r.get("northeastern_email") or "").strip().lower()
            name = r.get("name")
            if email and name and str(name).strip():
                lookup[email] = str(name).strip()
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return lookup


@leaderboard_bp.get("/", strict_slashes=False)
def get_leaderboard():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid Authorization header"}), 401
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"error": "Supabase credentials not configured on server"}), 500

    try:
        limit = min(max(int(request.args.get("limit", 50)), 1), 100)
    except ValueError:
        limit = 50

    try:
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        state_resp = sb.table(USER_STATE_TABLE).select("*").execute()
        state_rows = state_resp.data or []
        combined_lookup = load_combined_email_to_name(sb)
    except Exception as exc:
        return jsonify({"error": f"Supabase request failed: {exc}"}), 500

    entries = []
    for row in state_rows:
        owner_email = row.get(OWNER_EMAIL_COL)
        email_norm = str(owner_email or "").strip().lower()
        raw_list = raw_completed_field(row)
        completed_count = count_completed_chats(raw_list)

        name = display_name_from_state_row(row)
        if not name and email_norm:
            name = combined_lookup.get(email_norm)
        if not name and email_norm:
            name = email_norm.split("@", 1)[0]
        if not name:
            name = "Unknown"

        entries.append(
            {
                "email": email_norm or None,
                "name": name,
                "completed_count": completed_count,
            }
        )

    entries.sort(key=lambda e: (-e["completed_count"], e["name"].lower()))
    entries = entries[:limit]

    return jsonify({"entries": entries})
