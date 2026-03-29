import os
import json
from pathlib import Path

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
from supabase import create_client
from openai import OpenAI

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

matches_bp = Blueprint("matches", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY") or ""
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

EXPANSION_SYSTEM_PROMPT = (
    "You are a bot that converts an input in a small paragraph which is embedded into a vector "
    "and used to query a database. Your job is to convert whatever the input is into a form that "
    "provides a more accurate embedding. Format your response as a description of a hypothetical "
    "member that has the queries desired traits. Do not guess any information, only include what "
    "was requested in the query to generate your description."
)

PAGE_SIZE = 500
PHOTO_BUCKET = "profile-photos"


def _dot_product(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _parse_embedding(raw):
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


def _build_bucket_index(sb) -> dict[str, str]:
    """Return a map of base_filename -> full bucket filename.

    Some files are stored as 'attachment:UUID:actual_name.jpg' in the bucket.
    The 'picture' field in the DB only has 'actual_name.jpg', so we need this
    index to find the real bucket path.
    """
    try:
        files = sb.storage.from_(PHOTO_BUCKET).list(options={"limit": 1000})
    except Exception:
        return {}
    index = {}
    for f in files:
        full = f.get("name", "")
        if not full:
            continue
        base = full.rsplit(":", 1)[-1]  # strips "attachment:UUID:" prefix if present
        index[base] = full
    return index


def _photo_url(row: dict, bucket_index: dict) -> str | None:
    """Build a public photo URL from the row's 'picture' field.

    Tries each comma-separated filename and returns the first one that exists
    in the bucket index.
    """
    raw = (row.get("picture") or "").strip()
    if not raw:
        return None
    for candidate in raw.split(","):
        filename = candidate.strip()
        if not filename:
            continue
        if filename in bucket_index:
            full = bucket_index[filename]
            return f"{SUPABASE_URL}/storage/v1/object/public/{PHOTO_BUCKET}/{full}"
    return None


@matches_bp.get("/", strict_slashes=False)
def get_matches():
    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email query parameter is required"}), 400

    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"error": "Supabase credentials not configured on server"}), 500

    try:
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        resp = sb.table("combined").select("*").execute()
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
    bucket_index = _build_bucket_index(sb)

    hidden = {"embedding", "professional_embedding", "id", "created_at", "updated_at", "score"}
    matches = []
    for row in rows:
        if row.get(email_key, "").lower() == email:
            continue
        vec = _parse_embedding(row["embedding"])
        score = _dot_product(target_vec, vec)
        profile = {k: v for k, v in row.items() if k not in hidden and v is not None}
        profile["score"] = round(score, 4)
        url = _photo_url(row, bucket_index)
        if url:
            profile["photo_url"] = url
        matches.append(profile)

    matches.sort(key=lambda x: x["score"], reverse=True)
    matches = matches[:3]

    return jsonify({"target": target_row.get("name", ""), "matches": matches})


@matches_bp.post("/search", strict_slashes=False)
def search_matches():
    body = request.get_json(silent=True) or {}
    query = body.get("query", "").strip()
    limit = min(int(body.get("limit", 5)), 20)

    if not query:
        return jsonify({"error": "query is required"}), 400

    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"error": "Supabase credentials not configured on server"}), 500

    if not OPENAI_API_KEY:
        return jsonify({"error": "OpenAI credentials not configured on server"}), 500

    openai_client = OpenAI(api_key=OPENAI_API_KEY)

    try:
        expansion = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": EXPANSION_SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            temperature=0.3,
        )
        expanded = expansion.choices[0].message.content.strip()
    except Exception as exc:
        return jsonify({"error": f"OpenAI expansion failed: {exc}"}), 500

    try:
        embedding_resp = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=expanded,
        )
        query_vec = embedding_resp.data[0].embedding
    except Exception as exc:
        return jsonify({"error": f"OpenAI embedding failed: {exc}"}), 500

    try:
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        offset = 0
        all_rows = []
        while True:
            resp = sb.table("combined").select("*").range(offset, offset + PAGE_SIZE - 1).execute()
            rows = resp.data or []
            all_rows.extend(rows)
            if len(rows) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
    except Exception as exc:
        return jsonify({"error": f"Supabase request failed: {exc}"}), 500

    bucket_index = _build_bucket_index(sb)

    hidden = {"embedding", "professional_embedding", "id", "created_at", "updated_at", "score"}
    scores = []
    for row in all_rows:
        raw = row.get("professional_embedding")
        vec = _parse_embedding(raw) if raw is not None else None
        if vec is None:
            continue
        score = _dot_product(query_vec, vec)
        profile = {k: v for k, v in row.items() if k not in hidden and v is not None}
        profile["score"] = round(score, 4)
        url = _photo_url(row, bucket_index)
        if url:
            profile["photo_url"] = url
        scores.append(profile)

    scores.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({
        "query": query,
        "expanded": expanded,
        "matches": scores[:limit],
    })
