from flask import Blueprint, request, jsonify
from openai import OpenAI
from supabase import create_client
import json
from pathlib import Path
import time

from .helpers import (
    SUPABASE_URL,
    SUPABASE_KEY,
    OPENAI_API_KEY,
    PAGE_SIZE,
    DISPLAY_COLUMNS,
    dot_product,
    parse_embedding,
    should_hide_alef_2026_classmate,
    excluded_emails_from_user_state_row,
    should_exclude_from_match_pool,
)
from .photos import build_bucket_index, photo_url

custom_bp = Blueprint("custom", __name__)

SELECT_COLUMNS = ",".join(
    DISPLAY_COLUMNS + ["professional_embedding", "picture", "is_graduated", "is_active"]
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
        embedding_resp = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query,
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

    excluded = set()
    req_email = (body.get("email") or "").strip().lower()
    if req_email:
        try:
            us_resp = (
                sb.table("user_state")
                .select("not_interested,pending,completed")
                .eq("northeastern_email", req_email)
                .execute()
            )
            if us_resp.data:
                excluded = excluded_emails_from_user_state_row(us_resp.data[0])
        except Exception:
            pass

    leaked_excluded_count = 0
    scores = []
    for row in all_rows:
        row_email = str(row.get("northeastern_email", "")).lower()
        if row_email in excluded:
            leaked_excluded_count += 1
            continue
        if should_hide_alef_2026_classmate(viewer_tamid, row.get("tamid_class")):
            continue
        if should_exclude_from_match_pool(row):
            continue
        raw = row.get("professional_embedding")
        vec = parse_embedding(raw) if raw is not None else None
        if vec is None:
            continue
        score = dot_product(query_vec, vec)
        profile = {
            k: v
            for k, v in row.items()
            if k not in ("professional_embedding", "picture", "is_graduated", "is_active") and v is not None
        }
        profile["score"] = round(score, 4)
        url = photo_url(row, bucket_index)
        if url:
            profile["photo_url"] = url
        scores.append(profile)

    # region agent log
    try:
        Path("/Users/rioquinn/Desktop/Coding Projects/tamidchatmatcher/.cursor/debug-be6e68.log").parent.mkdir(parents=True, exist_ok=True)
        with Path("/Users/rioquinn/Desktop/Coding Projects/tamidchatmatcher/.cursor/debug-be6e68.log").open("a", encoding="utf-8") as _f:
            _f.write(
                json.dumps(
                    {
                        "sessionId": "be6e68",
                        "runId": "post-fix",
                        "hypothesisId": "H3",
                        "location": "backend/routes/match_custom.py:134",
                        "message": "Search excluded (ni+pending+completed) telemetry",
                        "data": {
                            "reqEmail": req_email,
                            "excludedCount": len(excluded),
                            "leakedExcludedCount": leaked_excluded_count,
                            "scoresCount": len(scores),
                        },
                        "timestamp": int(time.time() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # endregion

    scores.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({
        "query": query,
        "matches": scores[:limit],
    })
