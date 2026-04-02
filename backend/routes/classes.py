from collections import Counter

from flask import Blueprint, request, jsonify
from supabase import create_client

from .helpers import (
    SUPABASE_URL,
    SUPABASE_KEY,
    PAGE_SIZE,
    should_exclude_from_match_pool,
    excluded_emails_from_user_state_row,
)

classes_bp = Blueprint("classes", __name__)

CLASS_SELECT = "tamid_class,is_graduated,is_active,northeastern_email,embedding"


@classes_bp.get("/", strict_slashes=False)
def list_classes():
    email = request.args.get("email", "").strip().lower()

    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"error": "Supabase credentials not configured on server"}), 500

    try:
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        offset = 0
        all_rows: list[dict] = []
        while True:
            resp = (
                sb.table("combined")
                .select(CLASS_SELECT)
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
            )
            rows = resp.data or []
            all_rows.extend(rows)
            if len(rows) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
    except Exception as exc:
        return jsonify({"error": f"Supabase request failed: {exc}"}), 500

    excluded = set()
    if email:
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

    viewer_class = None
    counts: Counter[str] = Counter()

    for row in all_rows:
        cls = (row.get("tamid_class") or "").strip()
        if not cls:
            continue

        row_email = str(row.get("northeastern_email", "")).strip().lower()
        if email and row_email == email:
            viewer_class = cls

        if row.get("embedding") is None:
            continue
        if should_exclude_from_match_pool(row):
            continue
        if row_email in excluded:
            continue
        counts[cls] += 1

    classes = sorted(
        [{"name": name, "count": count} for name, count in counts.items()],
        key=lambda c: c["name"],
    )

    return jsonify({"classes": classes, "viewer_class": viewer_class})
