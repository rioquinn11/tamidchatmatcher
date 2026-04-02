"""Embed professional fields from `public.combined` into `professional_embedding`.

Skips rows where `is_graduated` is truthy. Overwrites `professional_embedding` for every
other row with non-empty professional text. Prints index/id/email then the OpenAI input
on the next line. Paginates reads with PAGE_SIZE; omit --limit to process the full table.
"""

from __future__ import annotations

import argparse
import json
import sys
import os
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

TABLE = "combined"
# Rows per Supabase fetch (pagination only; full table is still processed).
PAGE_SIZE = 500
DRY_RUN = False

COLUMN_TEMPLATES: dict[str, str] = {
    "name":                      "This member's name is {}.",
    "major":                     "Their major is {}",
    "minor":                     "and their minor is {}.",
    "industry":                  "They are primarily involved in the {} industry.",
    "company_name":              "They have worked at {} as a job/internship.",
    "coop_name":                 "For their coop, they worked at {}.",
    #"post_college_job":          "After college they worked as {}",
    #"location":                  "They are located in {}",
    "tamid_class":               "They are a member of {} class",
    "track_involvement":         "and are currently a part of the {} track",
    "tamid_position":            ".Their current position is {}",
    "e_board_positions":         "but in the past they held the executive positions of {}",
    #"professional_experience":   "Their professional experience includes {}",
    "skills_tags":               "Their skills include {}",
    "hometown":                  "Their hometown is {}",
}

PROFESSIONAL_COLUMNS: list[str] = list(COLUMN_TEMPLATES.keys())

RAW_COLUMNS: set[str] = {"hometown"}


def get_embedding(text: str) -> list[float]:
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


def is_graduated_truthy(row: dict) -> bool:
    v = row.get("is_graduated")
    if v is True or v == 1:
        return True
    if isinstance(v, str) and v.strip().lower() in ("true", "t", "1", "yes"):
        return True
    return False


def _natural_list(raw: str) -> str:
    """Turn a comma-separated string into a natural English list.

    'A'         -> 'A'
    'A, B'      -> 'A and B'
    'A, B, C'   -> 'A, B, and C'
    """
    items = [i.strip() for i in raw.split(",") if i.strip()]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + ", and " + items[-1]


def build_professional_text(row: dict) -> str:
    sentences: list[str] = []
    for col in PROFESSIONAL_COLUMNS:
        val = row.get(col)
        if val is None:
            continue
        s = str(val).strip()
        if not s:
            continue
        template = COLUMN_TEMPLATES[col]
        formatted = s if col in RAW_COLUMNS else _natural_list(s)
        sentences.append(template.format(formatted))
    return " ".join(sentences)


def select_columns_expr() -> str:
    base = ["id", "northeastern_email", "is_graduated"]
    return ",".join(base + PROFESSIONAL_COLUMNS)


def update_professional_embedding(row_id, embedding: list[float]) -> None:
    last_err: Exception | None = None
    for val in (embedding, json.dumps(embedding)):
        try:
            supabase.table(TABLE).update({"professional_embedding": val}).eq("id", row_id).execute()
            return
        except Exception as e:
            last_err = e
    assert last_err is not None
    raise last_err


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill combined.professional_embedding",
        epilog=(
            "Example: from repo root, with OPENAI_API_KEY, SUPABASE_URL, and "
            "SUPABASE_SECRET_KEY in .env — "
            "python embedder/embed_professional.py --limit 5"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max rows to embed and upload (after filters). Omit for full table.",
    )
    args = parser.parse_args()

    select_expr = select_columns_expr()
    embedded = 0
    skipped_grad = 0
    skipped_empty = 0
    failed = 0
    offset = 0
    embed_index = 0

    while True:
        if args.limit is not None and embedded >= args.limit:
            break

        q = supabase.table(TABLE).select(select_expr).range(
            offset, offset + PAGE_SIZE - 1
        )

        try:
            resp = q.execute()
        except Exception as e:
            print(f"Error fetching rows at offset {offset}: {e}", file=sys.stderr)
            sys.exit(1)

        rows = resp.data or []
        if not rows:
            break

        for row in rows:
            if args.limit is not None and embedded >= args.limit:
                break

            if is_graduated_truthy(row):
                skipped_grad += 1
                continue

            text = build_professional_text(row)
            if not text:
                skipped_empty += 1
                continue

            rid = row["id"]
            email = row.get("northeastern_email") or ""
            embed_index += 1
            print(f"\n\n[{embed_index}] id={rid}\temail={email}")
            print(text)

            if not DRY_RUN:
                try:
                    emb = get_embedding(text)
                except Exception as e:
                    print(f"  OpenAI error for {rid}: {e}", file=sys.stderr)
                    failed += 1
                    continue

                try:
                    update_professional_embedding(rid, emb)
                except Exception as e:
                    print(f"  Supabase update error for {rid}: {e}", file=sys.stderr)
                    failed += 1
                    continue

            embedded += 1

        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    print(
        f"\nDone. embedded={embedded} skipped_graduated={skipped_grad} "
        f"skipped_empty_text={skipped_empty} failed={failed}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
