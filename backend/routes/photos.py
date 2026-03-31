from .helpers import SUPABASE_URL

PHOTO_BUCKET = "profile-photos"


def build_bucket_index(sb) -> dict[str, str]:
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
        base = full.rsplit(":", 1)[-1]
        index[base] = full
    return index


def photo_url(row: dict, bucket_index: dict) -> str | None:
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
