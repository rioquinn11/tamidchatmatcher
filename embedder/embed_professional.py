"""Group coop rows by Northeastern Email, embed merged professional fields, set profiles.professional_embedding.

Coop-only fields (e.g. Company Name) exist only on `coops`. Profiles may only have a subset; we read those
for fallback and profile-only embedding (see PROFILE_PROFESSIONAL_COLUMNS).

Second pass: profiles with Northeastern Email, not graduated, and any embeddable professional fields
(not updated in coop pass — e.g. no coop row) still get embedded.

Skips anyone whose profiles row has Graduated = true (both passes).
"""

import sys
import os
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not all([OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    print(
        "Error: Missing one or more required environment variables: "
        "OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY"
    )
    sys.exit(1)

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

COOP_TABLE = "coops"
COOP_PK = "id"
GRADUATED_COL = "Graduated"

PROFILES_TABLE = "profiles"
PERSON_KEY = "Northeastern Email"
PROFESSIONAL_EMBEDDING_COL = "professional embedding"
PROFILE_ORDER_COL = "id"  # stable pagination for profile-only pass; change if your table differs

# Supabase coop columns merged (per column across jobs, then comma-separated) for embedding.
PROFESSIONAL_COLUMNS: list[str] = [
    "Company Name",
    "Coop Name",
    "Full Time Company",
    "Industry",
    "Major(s)",
    "Minor(s)",
    "Skills/Tags",
    "TAMID Class",
    "Track Involvement",
]

# Columns that exist on `profiles` (must match your Supabase schema). Not all coops columns exist there.
PROFILE_PROFESSIONAL_COLUMNS: frozenset[str] = frozenset({"Major(s)", "Minor(s)"})


def get_embedding(text: str) -> list[float]:
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


def _merge_column_across_rows(rows: list[dict], col: str) -> str | None:
    seen: set[str] = set()
    ordered: list[str] = []
    for row in rows:
        val = row.get(col)
        if val is None:
            continue
        s = str(val).strip()
        if not s or s in seen:
            continue
        seen.add(s)
        ordered.append(s)
    return ", ".join(ordered) if ordered else None


def profile_value_for_column(profile_row: dict, col: str) -> str | None:
    v = profile_row.get(col)
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def profile_is_graduated(profile_row: dict) -> bool:
    v = profile_row.get(GRADUATED_COL)
    if v is True or v == 1:
        return True
    if isinstance(v, str) and v.strip().lower() in ("true", "t", "1", "yes"):
        return True
    return False


def build_professional_text(rows: list[dict], profile_row: dict | None) -> str:
    segments: list[str] = []
    for col in PROFESSIONAL_COLUMNS:
        merged = _merge_column_across_rows(rows, col)
        if not merged and profile_row and col in PROFILE_PROFESSIONAL_COLUMNS:
            merged = profile_value_for_column(profile_row, col)
        if merged:
            segments.append(merged)
    return ", ".join(segments)


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def postgrest_quoted_column(name: str) -> str:
    """Use for .select/.eq column names when `name` has spaces or odd chars.

    postgrest-py strips spaces from unquoted select tokens; quoted identifiers are preserved.
    Filters use sanitize_param; wrapping in Postgres-style quotes keeps the name intact.
    """
    return quote_ident(name)


def coop_select_columns() -> str:
    cols = {COOP_PK, GRADUATED_COL, PERSON_KEY}
    for col in PROFESSIONAL_COLUMNS:
        cols.add(col)
    return ",".join(quote_ident(c) for c in sorted(cols))


def profiles_select_for_embedding() -> str:
    """Profile columns we read (identity + Graduated + fields that exist on profiles only)."""
    cols: set[str] = {PERSON_KEY, GRADUATED_COL, *PROFILE_PROFESSIONAL_COLUMNS}
    return ",".join(postgrest_quoted_column(c) for c in sorted(cols))


def embed_and_update_profile(
    email: str,
    person_col: str,
    text: str,
) -> None:
    embedding = get_embedding(text)
    supabase.table(PROFILES_TABLE).update(
        {PROFESSIONAL_EMBEDDING_COL: embedding}
    ).eq(person_col, email).execute()


def main() -> None:
    select_str = coop_select_columns()
    response = (
        supabase.table(COOP_TABLE)
        .select(select_str)
        .eq(GRADUATED_COL, False)
        .execute()
    )
    rows = response.data or []

    if not rows:
        print("No coop rows with graduated? = false. (Profile-only pass still runs.)\n")

    groups: dict[str, list[dict]] = defaultdict(list)
    rep_email: dict[str, str] = {}
    skipped_no_email = 0

    for row in rows:
        raw = row.get(PERSON_KEY)
        if raw is None or not str(raw).strip():
            skipped_no_email += 1
            continue
        email = str(raw).strip()
        key = email.lower()
        if key not in rep_email:
            rep_email[key] = email
        groups[key].append(row)

    n_people = len(groups)
    print(
        f"Loaded {len(rows)} coop row(s), {n_people} distinct {PERSON_KEY}(s)"
        + (f", skipped {skipped_no_email} row(s) with blank email.\n" if skipped_no_email else ".\n")
    )

    success_count = 0
    skipped_empty = 0
    skipped_no_profile = 0
    skipped_profile_graduated = 0
    processed_email_keys: set[str] = set()

    person_col = postgrest_quoted_column(PERSON_KEY)
    profiles_select = profiles_select_for_embedding()

    for i, (key, group_rows) in enumerate(sorted(groups.items(), key=lambda x: x[0]), start=1):
        email = rep_email[key]
        sorted_rows = sorted(
            group_rows,
            key=lambda r: (r.get(COOP_PK) is None, r.get(COOP_PK)),
        )

        prof = (
            supabase.table(PROFILES_TABLE)
            .select(profiles_select)
            .eq(person_col, email)
            .limit(1)
            .execute()
        )
        if not prof.data:
            print(f"--- Person {i}/{n_people} ({PERSON_KEY}={email}) ---")
            print(f"[{i}] Skipped — no matching row in {PROFILES_TABLE!r}.\n")
            skipped_no_profile += 1
            continue

        profile_row = prof.data[0]
        if profile_is_graduated(profile_row):
            print(f"--- Person {i}/{n_people} ({PERSON_KEY}={email}) ---")
            print(
                f"[{i}] Skipped — {PROFILES_TABLE}.{GRADUATED_COL} is true on profile.\n"
            )
            skipped_profile_graduated += 1
            continue

        text = build_professional_text(sorted_rows, profile_row)
        print(f"--- Person {i}/{n_people} ({PERSON_KEY}={email}) ---")
        print(text)
        print()

        if not text:
            print(f"[{i}] Skipped — no non-empty professional fields to embed.\n")
            skipped_empty += 1
            continue

        try:
            embed_and_update_profile(email, person_col, text)
            print(f"[{i}] {PROFESSIONAL_EMBEDDING_COL} updated on {PROFILES_TABLE!r}.\n")
            success_count += 1
            processed_email_keys.add(key)
        except Exception as e:
            print(f"[{i}] Failed: {e}\n")

    print(
        f"Coop pass done. {success_count}/{n_people} profiles updated; "
        f"skipped empty text: {skipped_empty}, no profile: {skipped_no_profile}, "
        f"profile graduated: {skipped_profile_graduated}, "
        f"blank coop email: {skipped_no_email}.\n"
    )

    # Profiles with professional fields who were not updated above (e.g. no non-graduated coop row).
    profile_only_success = 0
    profile_only_failed = 0
    profile_only_skipped_graduated = 0
    page_size = 500
    offset = 0
    print("Profile-only pass (professional fields on profiles, not updated in coop pass)...\n")

    while True:
        batch_resp = (
            supabase.table(PROFILES_TABLE)
            .select(profiles_select)
            .not_.is_(person_col, "null")
            .order(PROFILE_ORDER_COL)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = batch_resp.data or []
        if not batch:
            break

        for profile_row in batch:
            raw = profile_row.get(PERSON_KEY)
            if raw is None or not str(raw).strip():
                continue
            email = str(raw).strip()
            key = email.lower()
            if key in processed_email_keys:
                continue
            if profile_is_graduated(profile_row):
                profile_only_skipped_graduated += 1
                continue
            text = build_professional_text([], profile_row)
            if not text:
                continue
            label = f"{PERSON_KEY}={email}"
            print(f"--- Profile-only ({label}) ---")
            print(text)
            print()
            try:
                embed_and_update_profile(email, person_col, text)
                print(f"[+] {PROFESSIONAL_EMBEDDING_COL} updated (profile-only).\n")
                processed_email_keys.add(key)
                profile_only_success += 1
            except Exception as e:
                print(f"[!] Failed (profile-only): {e}\n")
                profile_only_failed += 1

        if len(batch) < page_size:
            break
        offset += page_size

    print(
        f"Done. Coop pass updates: {success_count}; profile-only updates: {profile_only_success}; "
        f"profile-only failures: {profile_only_failed}; "
        f"profile-only skipped (profile graduated): {profile_only_skipped_graduated}."
    )


if __name__ == "__main__":
    main()
