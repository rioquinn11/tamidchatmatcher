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


# Words to strip from bucket filename keys before matching
_NOISE_WORDS = {
    "headshot", "photo", "pic", "picture", "img", "image", "original",
    "screenshot", "avatar", "profile", "pfp", "head", "portrait",
}

# Regex-like patterns that indicate a key is just a UUID or timestamp (not a name)
def _is_junk_key(key: str) -> bool:
    # Pure UUID / hex / numeric / screenshot timestamp patterns
    import re
    if re.fullmatch(r'[0-9a-f\-]{8,}', key):
        return True
    if re.match(r'screenshot \d', key):
        return True
    if re.match(r'(img|dsc\d*|dsc) [\d\s]+', key):
        return True
    return False


def _clean_key(raw: str) -> str:
    """Remove noise words, leaving only likely name tokens."""
    words = [w for w in raw.split() if w not in _NOISE_WORDS]
    return " ".join(words).strip()


def _fetch_photo_map(sb) -> dict[str, str]:
    """Return a dict mapping normalized name -> public photo URL.

    Also pre-computes an 'ambiguous_keys' set for single-word keys that match
    multiple DB members — those should not be used for matching.
    """
    try:
        files = sb.storage.from_(PHOTO_BUCKET).list(options={"limit": 1000})
        db_rows = sb.table("combined").select("name").execute()
    except Exception:
        return {}

    db_first_names: dict[str, int] = {}
    for r in (db_rows.data or []):
        n = (r.get("name") or "").strip().lower()
        if n:
            first = n.split()[0]
            db_first_names[first] = db_first_names.get(first, 0) + 1

    photo_map: dict[str, str] = {}
    for f in files:
        filename = f.get("name", "")
        if not filename:
            continue
        display = filename.rsplit(":", 1)[-1] if filename.startswith("attachment:") else filename
        name_part = display.rsplit("_-_", 1)[-1] if "_-_" in display else display
        name_part = name_part.rsplit(".", 1)[0].replace("_", " ").lower().strip()
        if not name_part or _is_junk_key(name_part):
            continue
        cleaned = _clean_key(name_part)
        if not cleaned:
            continue
        # Skip single-word keys that match multiple DB members (ambiguous)
        if len(cleaned.split()) == 1 and db_first_names.get(cleaned, 0) > 1:
            continue
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{PHOTO_BUCKET}/{filename}"
        photo_map[cleaned] = public_url
    return photo_map


def _ascii(s: str) -> str:
    """Strip unicode accents for fuzzy matching (e.g. ç -> c)."""
    import unicodedata
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()


def _lookup_photo(name: str, photo_map: dict[str, str]) -> str | None:
    if not name or not photo_map:
        return None
    key = name.lower().strip()
    key_ascii = _ascii(name)
    words = key.split()

    for map_key, url in photo_map.items():
        mk_ascii = _ascii(map_key)
        mk_words = map_key.split()

        # 1. Exact match (with and without unicode normalization)
        if key == map_key or key_ascii == mk_ascii:
            return url

        # 2. All DB name words found in bucket key words
        if words and set(words) <= set(mk_words):
            return url

        # 3. All bucket key words found in DB name (first-name-only bucket keys)
        if mk_words and set(mk_words) <= set(words):
            return url

        # 4. First-name + initial match: "Alexa P" matches "Alexa Polanco"
        if len(mk_words) == 2 and len(mk_words[1]) == 1:
            if len(words) >= 2 and words[0] == mk_words[0] and words[-1].startswith(mk_words[1]):
                return url

        # 5. Prefix/typo tolerance: bucket key starts with DB name (handles extra trailing chars)
        if len(mk_ascii) >= 6 and mk_ascii.startswith(key_ascii):
            return url
        if len(key_ascii) >= 6 and key_ascii.startswith(mk_ascii):
            return url

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

    photo_map = _fetch_photo_map(sb)

    hidden = {"embedding", "id", "created_at", "updated_at", "score"}
    matches = []
    for row in rows:
        if row.get(email_key, "").lower() == email:
            continue
        vec = _parse_embedding(row["embedding"])
        score = _dot_product(target_vec, vec)
        profile = {k: v for k, v in row.items() if k not in hidden and v is not None}
        profile["score"] = round(score, 4)
        photo_url = _lookup_photo(row.get("name", ""), photo_map)
        if photo_url:
            profile["photo_url"] = photo_url
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

    photo_map = _fetch_photo_map(sb)

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
        photo_url = _lookup_photo(row.get("name", ""), photo_map)
        if photo_url:
            profile["photo_url"] = photo_url
        scores.append(profile)

    scores.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({
        "query": query,
        "expanded": expanded,
        "matches": scores[:limit],
    })
