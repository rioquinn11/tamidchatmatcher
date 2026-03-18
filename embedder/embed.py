import sys
import json
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
    print("Error: Missing one or more required environment variables: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY")
    sys.exit(1)

openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_embedding(text: str) -> list[float]:
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


def upsert_member(name: str, embedding: list[float]) -> None:
    supabase.table("vectors").upsert(
        {"name": name, "embedding": embedding},
        on_conflict="name",
    ).execute()


def main():
    if len(sys.argv) != 2:
        print("Usage: python embed.py <input_file.json>")
        sys.exit(1)

    input_path = sys.argv[1]

    try:
        with open(input_path, "r") as f:
            entries = json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{input_path}' not found.")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Could not parse JSON file — {e}")
        sys.exit(1)

    if not isinstance(entries, list):
        print("Error: JSON file must contain a top-level array of objects.")
        sys.exit(1)

    print(f"Processing {len(entries)} entr{'y' if len(entries) == 1 else 'ies'}...\n")

    success_count = 0
    for i, entry in enumerate(entries, start=1):
        name = entry.get("name")
        text = entry.get("text")

        if not name or not text:
            print(f"[{i}] Skipped — missing 'name' or 'text' field.")
            continue

        try:
            embedding = get_embedding(text)
            upsert_member(name, embedding)
            print(f"[{i}] '{name}' — embedded and uploaded successfully.")
            success_count += 1
        except Exception as e:
            print(f"[{i}] '{name}' — failed: {e}")

    print(f"\nDone. {success_count}/{len(entries)} entries uploaded.")


if __name__ == "__main__":
    main()
