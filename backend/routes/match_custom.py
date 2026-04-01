from flask import Blueprint, request, jsonify
from openai import OpenAI
from supabase import create_client

from .helpers import (
    SUPABASE_URL,
    SUPABASE_KEY,
    OPENAI_API_KEY,
    PAGE_SIZE,
    DISPLAY_COLUMNS,
    dot_product,
    parse_embedding,
    should_hide_alef_2026_classmate,
)
from .photos import build_bucket_index, photo_url

custom_bp = Blueprint("custom", __name__)

SELECT_COLUMNS = ",".join(DISPLAY_COLUMNS + ["professional_embedding", "picture"])

EXPANSION_SYSTEM_PROMPT = (
    "You are a bot that converts an input in a small paragraph which is embedded into a vector "
    "and used to query a database. Your job is to convert whatever the input is into a form that "
    "provides a more accurate embedding. Format your response as a description of a hypothetical "
    "member that has the queries desired traits. Do not guess any information, only include what "
    "was requested in the query to generate your description."
)


@custom_bp.post("/search", strict_slashes=False)
def search_matches():
    body = request.get_json(silent=True) or {}
    query = body.get("query", "").strip()
    try:
        raw_limit = int(body.get("limit", 10))
    except (TypeError, ValueError):
        raw_limit = 10
    limit = max(1, min(raw_limit, 50))

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
            resp = sb.table("combined").select(SELECT_COLUMNS).range(offset, offset + PAGE_SIZE - 1).execute()
            rows = resp.data or []
            all_rows.extend(rows)
            if len(rows) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
    except Exception as exc:
        return jsonify({"error": f"Supabase request failed: {exc}"}), 500

    viewer_email = str(body.get("email", "")).strip().lower()
    viewer_tamid = None
    if viewer_email:
        for r in all_rows:
            if str(r.get("northeastern_email", "")).lower() == viewer_email:
                viewer_tamid = r.get("tamid_class")
                break

    bucket_index = build_bucket_index(sb)

    not_interested = set()
    req_email = (body.get("email") or "").strip().lower()
    if req_email:
        try:
            us_resp = sb.table("user_state").select("not_interested").eq("northeastern_email", req_email).execute()
            if us_resp.data:
                ni_raw = us_resp.data[0].get("not_interested") or ""
                not_interested = {e.strip().lower() for e in ni_raw.split(",") if e.strip()}
        except Exception:
            pass

    scores = []
    for row in all_rows:
        if should_hide_alef_2026_classmate(viewer_tamid, row.get("tamid_class")):
            continue
        raw = row.get("professional_embedding")
        vec = parse_embedding(raw) if raw is not None else None
        if vec is None:
            continue
        score = dot_product(query_vec, vec)
        profile = {k: v for k, v in row.items() if k not in ("professional_embedding", "picture") and v is not None}
        profile["score"] = round(score, 4)
        url = photo_url(row, bucket_index)
        if url:
            profile["photo_url"] = url
        scores.append(profile)

    scores.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({
        "query": query,
        "expanded": expanded,
        "matches": scores[:limit],
    })
