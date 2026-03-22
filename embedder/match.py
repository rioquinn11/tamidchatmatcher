import sys
import os
import json
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

TARGET = "Rio Quinn"


def dot_product(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def main():
    response = supabase.table("vectors").select("name, embedding").execute()
    rows = response.data

    if not rows:
        print("No rows found in the vectors table.")
        sys.exit(1)

    rio_row = next((r for r in rows if r["name"] == TARGET), None)
    if rio_row is None:
        print(f"Error: '{TARGET}' not found in the vectors table.")
        sys.exit(1)

    rio_vec = json.loads(rio_row["embedding"]) if isinstance(rio_row["embedding"], str) else rio_row["embedding"]

    scores = []
    for row in rows:
        if row["name"] == TARGET:
            continue
        vec = json.loads(row["embedding"]) if isinstance(row["embedding"], str) else row["embedding"]
        score = dot_product(rio_vec, vec)
        scores.append((row["name"], score))

    scores.sort(key=lambda x: x[1], reverse=True)

    print(f"\nSimilarity to {TARGET}")
    print("=" * 40)
    for rank, (name, score) in enumerate(scores, start=1):
        print(f" {rank:2}. {name:<30} {score:.4f}")
    print()


if __name__ == "__main__":
    main()
