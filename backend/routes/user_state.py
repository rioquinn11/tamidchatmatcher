from flask import Blueprint, request, jsonify
from supabase import create_client

from .helpers import SUPABASE_URL, SUPABASE_KEY, DISPLAY_COLUMNS
from .photos import build_bucket_index, photo_url

user_state_bp = Blueprint("user_state", __name__)

PROFILE_SELECT = ",".join(DISPLAY_COLUMNS + ["picture"])

COLUMNS = ("not_interested", "pending", "completed")


def _parse_csv(text):
    if not text:
        return set()
    return {e.strip().lower() for e in text.split(",") if e.strip()}


def _to_csv(emails):
    return ",".join(sorted(emails)) if emails else None


def _get_row(sb, user_email):
    resp = (
        sb.table("user_state")
        .select("id,northeastern_email,not_interested,pending,completed")
        .eq("northeastern_email", user_email)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None


@user_state_bp.get("/", strict_slashes=False)
def get_user_state():
    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email query parameter is required"}), 400

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    row = _get_row(sb, email)

    if not row:
        return jsonify({col: [] for col in COLUMNS})

    return jsonify({
        col: sorted(_parse_csv(row.get(col))) for col in COLUMNS
    })


@user_state_bp.post("/not-interested", strict_slashes=False)
def add_not_interested():
    body = request.get_json(silent=True) or {}
    user_email = body.get("user_email", "").strip().lower()
    target_email = body.get("target_email", "").strip().lower()

    if not user_email or not target_email:
        return jsonify({"error": "user_email and target_email are required"}), 400

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    row = _get_row(sb, user_email)

    if row:
        emails = _parse_csv(row.get("not_interested"))
        emails.add(target_email)
        pending = _parse_csv(row.get("pending"))
        pending.discard(target_email)
        sb.table("user_state").update({
            "not_interested": _to_csv(emails),
            "pending": _to_csv(pending),
        }).eq("id", row["id"]).execute()
    else:
        sb.table("user_state").insert({
            "northeastern_email": user_email,
            "not_interested": target_email,
        }).execute()

    return jsonify({"ok": True})


@user_state_bp.get("/not-interested/profiles", strict_slashes=False)
def get_not_interested_profiles():
    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email query parameter is required"}), 400

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    row = _get_row(sb, email)
    if not row:
        return jsonify({"profiles": []})

    ni_emails = _parse_csv(row.get("not_interested"))
    if not ni_emails:
        return jsonify({"profiles": []})

    bucket_index = build_bucket_index(sb)
    profiles = []
    for ni_email in ni_emails:
        resp = sb.table("combined").select(PROFILE_SELECT).eq("northeastern_email", ni_email).execute()
        if resp.data:
            r = resp.data[0]
            profile = {k: v for k, v in r.items() if k != "picture" and v is not None}
            url = photo_url(r, bucket_index)
            if url:
                profile["photo_url"] = url
            profiles.append(profile)

    return jsonify({"profiles": profiles})


@user_state_bp.post("/pending", strict_slashes=False)
def add_pending():
    body = request.get_json(silent=True) or {}
    user_email = body.get("user_email", "").strip().lower()
    target_email = body.get("target_email", "").strip().lower()

    if not user_email or not target_email:
        return jsonify({"error": "user_email and target_email are required"}), 400

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    row = _get_row(sb, user_email)

    if row:
        emails = _parse_csv(row.get("pending"))
        emails.add(target_email)
        sb.table("user_state").update({"pending": _to_csv(emails)}).eq("id", row["id"]).execute()
    else:
        sb.table("user_state").insert({
            "northeastern_email": user_email,
            "pending": target_email,
        }).execute()

    return jsonify({"ok": True})


@user_state_bp.get("/pending/profiles", strict_slashes=False)
def get_pending_profiles():
    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email query parameter is required"}), 400

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    row = _get_row(sb, email)
    if not row:
        return jsonify({"profiles": []})

    pending_emails = _parse_csv(row.get("pending"))
    if not pending_emails:
        return jsonify({"profiles": []})

    bucket_index = build_bucket_index(sb)
    profiles = []
    for p_email in pending_emails:
        resp = sb.table("combined").select(PROFILE_SELECT).eq("northeastern_email", p_email).execute()
        if resp.data:
            r = resp.data[0]
            profile = {k: v for k, v in r.items() if k != "picture" and v is not None}
            url = photo_url(r, bucket_index)
            if url:
                profile["photo_url"] = url
            profiles.append(profile)

    return jsonify({"profiles": profiles})


@user_state_bp.delete("/pending", strict_slashes=False)
def remove_pending():
    body = request.get_json(silent=True) or {}
    user_email = body.get("user_email", "").strip().lower()
    target_email = body.get("target_email", "").strip().lower()

    if not user_email or not target_email:
        return jsonify({"error": "user_email and target_email are required"}), 400

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    row = _get_row(sb, user_email)

    if not row:
        return jsonify({"ok": True})

    emails = _parse_csv(row.get("pending"))
    emails.discard(target_email)
    sb.table("user_state").update({"pending": _to_csv(emails)}).eq("id", row["id"]).execute()

    return jsonify({"ok": True})


@user_state_bp.post("/pending/complete", strict_slashes=False)
def complete_pending():
    """Remove target from pending and add to completed."""
    body = request.get_json(silent=True) or {}
    user_email = body.get("user_email", "").strip().lower()
    target_email = body.get("target_email", "").strip().lower()

    if not user_email or not target_email:
        return jsonify({"error": "user_email and target_email are required"}), 400

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    row = _get_row(sb, user_email)

    if not row:
        return jsonify({"error": "no user_state row"}), 400

    pending = _parse_csv(row.get("pending"))
    if target_email not in pending:
        return jsonify({"error": "target not in pending"}), 400

    pending.discard(target_email)
    completed = _parse_csv(row.get("completed"))
    completed.add(target_email)

    sb.table("user_state").update({
        "pending": _to_csv(pending),
        "completed": _to_csv(completed),
    }).eq("id", row["id"]).execute()

    return jsonify({"ok": True})


@user_state_bp.get("/completed/profiles", strict_slashes=False)
def get_completed_profiles():
    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email query parameter is required"}), 400

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    row = _get_row(sb, email)
    if not row:
        return jsonify({"profiles": []})

    completed_emails = _parse_csv(row.get("completed"))
    if not completed_emails:
        return jsonify({"profiles": []})

    bucket_index = build_bucket_index(sb)
    profiles = []
    for c_email in completed_emails:
        resp = sb.table("combined").select(PROFILE_SELECT).eq("northeastern_email", c_email).execute()
        if resp.data:
            r = resp.data[0]
            profile = {k: v for k, v in r.items() if k != "picture" and v is not None}
            url = photo_url(r, bucket_index)
            if url:
                profile["photo_url"] = url
            profiles.append(profile)

    return jsonify({"profiles": profiles})


@user_state_bp.delete("/completed", strict_slashes=False)
def remove_completed():
    body = request.get_json(silent=True) or {}
    user_email = body.get("user_email", "").strip().lower()
    target_email = body.get("target_email", "").strip().lower()

    if not user_email or not target_email:
        return jsonify({"error": "user_email and target_email are required"}), 400

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    row = _get_row(sb, user_email)

    if not row:
        return jsonify({"ok": True})

    emails = _parse_csv(row.get("completed"))
    emails.discard(target_email)
    sb.table("user_state").update({"completed": _to_csv(emails)}).eq("id", row["id"]).execute()

    return jsonify({"ok": True})


@user_state_bp.delete("/not-interested", strict_slashes=False)
def remove_not_interested():
    body = request.get_json(silent=True) or {}
    user_email = body.get("user_email", "").strip().lower()
    target_email = body.get("target_email", "").strip().lower()

    if not user_email or not target_email:
        return jsonify({"error": "user_email and target_email are required"}), 400

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    row = _get_row(sb, user_email)

    if not row:
        return jsonify({"ok": True})

    emails = _parse_csv(row.get("not_interested"))
    emails.discard(target_email)
    sb.table("user_state").update({"not_interested": _to_csv(emails)}).eq("id", row["id"]).execute()

    return jsonify({"ok": True})
