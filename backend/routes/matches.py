import os
import json
from pathlib import Path

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
from supabase import create_client

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

matches_bp = Blueprint("matches", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY") or ""


def _dot_product(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _parse_embedding(raw):
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


@matches_bp.get("/", strict_slashes=False)
def get_matches():
    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email query parameter is required"}), 400

    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"error": "Supabase credentials not configured on server"}), 500

    try:
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        resp = sb.table("profiles").select("*").execute()
        all_rows = resp.data
    except Exception as exc:
        return jsonify({"error": f"Supabase request failed: {exc}"}), 500

    rows = [r for r in all_rows if r.get("embedding") is not None]

    if not rows:
        return jsonify({"target": None, "matches": []})

    email_key = next((k for k in rows[0] if "email" in k.lower()), None)
    target_row = None
    if email_key:
        target_row = next(
            (r for r in rows if str(r.get(email_key, "")).lower() == email),
            None,
        )

    if target_row is None:
        return jsonify({
            "error": f"No profile found for '{email}'",
            "target": None,
            "matches": [],
        })

    target_vec = _parse_embedding(target_row["embedding"])

    hidden = {"embedding", "id", "created_at", "updated_at", "score"}
    matches = []
    for row in rows:
        if row.get(email_key, "").lower() == email:
            continue
        vec = _parse_embedding(row["embedding"])
        score = _dot_product(target_vec, vec)
        profile = {k: v for k, v in row.items() if k not in hidden and v is not None}
        profile["score"] = round(score, 4)
        matches.append(profile)

    matches.sort(key=lambda x: x["score"], reverse=True)
    matches = matches[:3]

    return jsonify({"target": target_row.get("name", ""), "matches": matches})
