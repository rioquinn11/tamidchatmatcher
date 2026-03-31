from flask import Blueprint, request, jsonify
from supabase import create_client

from .helpers import (
    SUPABASE_URL,
    SUPABASE_KEY,
    DISPLAY_COLUMNS,
    dot_product,
    parse_embedding,
    should_hide_alef_2026_classmate,
)
from .photos import build_bucket_index, photo_url

introductions_bp = Blueprint("introductions", __name__)

SELECT_COLUMNS = ",".join(DISPLAY_COLUMNS + ["embedding", "picture"])


@introductions_bp.get("/", strict_slashes=False)
def get_matches():
    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email query parameter is required"}), 400

    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"error": "Supabase credentials not configured on server"}), 500

    try:
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        resp = sb.table("combined").select(SELECT_COLUMNS).execute()
        all_rows = resp.data
    except Exception as exc:
        return jsonify({"error": f"Supabase request failed: {exc}"}), 500

    rows = [r for r in all_rows if r.get("embedding") is not None]

    if not rows:
        return jsonify({"target": None, "matches": []})

    target_row = next(
        (r for r in rows if str(r.get("northeastern_email", "")).lower() == email),
        None,
    )

    if target_row is None:
        return jsonify({
            "error": f"No profile found for '{email}'",
            "target": None,
            "matches": [],
        })

    target_vec = parse_embedding(target_row["embedding"])
    bucket_index = build_bucket_index(sb)

    matches = []
    for row in rows:
        if str(row.get("northeastern_email", "")).lower() == email:
            continue
        if should_hide_alef_2026_classmate(
            target_row.get("tamid_class"), row.get("tamid_class")
        ):
            continue
        vec = parse_embedding(row["embedding"])
        score = dot_product(target_vec, vec)
        profile = {k: v for k, v in row.items() if k not in ("embedding", "picture") and v is not None}
        profile["score"] = round(score, 4)
        url = photo_url(row, bucket_index)
        if url:
            profile["photo_url"] = url
        matches.append(profile)

    matches.sort(key=lambda x: x["score"], reverse=True)
    matches = matches[:10]

    return jsonify({"target": target_row.get("name", ""), "matches": matches})
