"""Rank rows in `public.combined` by dot product of a query embedding vs `professional_embedding`."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

QUERY_TEXT = "Scotia Bank"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

TABLE = "combined"
PAGE_SIZE = 500

if not all([OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    print(
        "Error: Missing one or more required environment variables: "
        "OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY",
        file=sys.stderr,
    )
    sys.exit(1)

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


EXPANSION_SYSTEM_PROMPT = (
    "You are a bot that converts an input in a small paragraph which is embedded into a vector and used to query a database. Your job is is to convert whatever the input is into a form that provides a more accurate embedding. Format your response as a description of a hypothetical member that has the queries desired traits. Do not guess any information, only include what was requested in the query to generate your description."
)


def expand_query(text: str) -> str:
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": EXPANSION_SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


def get_embedding(text: str) -> list[float]:
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


def parse_vector(raw) -> list[float] | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, list) else None
    if isinstance(raw, list):
        return raw
    return None


def dot_product(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return float("nan")
    return sum(x * y for x, y in zip(a, b))


def display_name(row: dict) -> str:
    name = row.get("name")
    if name is not None and str(name).strip():
        return str(name).strip()
    email = row.get("northeastern_email")
    if email is not None and str(email).strip():
        return str(email).strip()
    return "(no name)"


def main() -> None:
    expanded = expand_query(QUERY_TEXT)
    print(f"Expanded query: {expanded}\n")
    query = get_embedding(expanded)

    offset = 0
    scores: list[tuple[str, float]] = []

    while True:
        try:
            resp = (
                supabase.table(TABLE)
                .select("name, northeastern_email, professional_embedding")
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
            )
        except Exception as e:
            print(f"Error fetching rows at offset {offset}: {e}", file=sys.stderr)
            sys.exit(1)

        rows = resp.data or []
        if not rows:
            break

        for row in rows:
            raw = row.get("professional_embedding")
            vec = parse_vector(raw)
            if vec is None:
                continue
            dp = dot_product(query, vec)
            if dp != dp:  # NaN from length mismatch
                continue
            scores.append((display_name(row), dp))

        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    scores.sort(key=lambda x: x[1], reverse=True)

    print(f"\nProfessional match ranking for query: {QUERY_TEXT!r}")
    print("=" * 60)
    for rank, (name, score) in enumerate(scores, start=1):
        print(f" {rank:3}. {name:<40} {score:.8f}")
    print()


if __name__ == "__main__":
    main()
