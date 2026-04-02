from flask import Blueprint, request, jsonify
from supabase import create_client

from .helpers import (
    SUPABASE_URL,
    SUPABASE_KEY,
    DISPLAY_COLUMNS,
    dot_product,
    parse_embedding,
    excluded_emails_from_user_state_row,
    should_exclude_from_match_pool,
)
from .photos import build_bucket_index, photo_url

introductions_bp = Blueprint("introductions", __name__)

SELECT_COLUMNS = ",".join(DISPLAY_COLUMNS + ["embedding", "picture", "is_graduated", "is_active"])


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

    exclude_classes_raw = request.args.get("exclude_classes", "")
    exclude_classes = {c.strip() for c in exclude_classes_raw.split(",") if c.strip()} if exclude_classes_raw else set()

    excluded = set()
    try:
        us_resp = (
            sb.table("user_state")
            .select("not_interested,pending,completed")
            .eq("northeastern_email", email)
            .execute()
        )
        if us_resp.data:
            excluded = excluded_emails_from_user_state_row(us_resp.data[0])
    except Exception:
        pass

    matches = []
    for row in rows:
        row_email = str(row.get("northeastern_email", "")).lower()
        if row_email == email or row_email in excluded:
            continue
        if exclude_classes and (row.get("tamid_class") or "").strip() in exclude_classes:
            continue
        if should_exclude_from_match_pool(row):
            continue
        vec = parse_embedding(row["embedding"])
        score = dot_product(target_vec, vec)
        profile = {
            k: v
            for k, v in row.items()
            if k not in ("embedding", "picture", "is_graduated", "is_active") and v is not None
        }
        profile["score"] = round(score, 4)
        url = photo_url(row, bucket_index)
        if url:
            profile["photo_url"] = url
        matches.append(profile)

    matches.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({"target": target_row.get("name", ""), "matches": matches})
