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

TARGET = "Shaurya Dubey"




def weights(a: list[float], b: list[float]) -> float:
    #a = [0 if -0.05 < x < 0.05 else x for x in a]
    #b = [0 if -0.05 < x < 0.05 else x for x in b]


    return sum( (ai * bi) for ai, bi in zip(a, b))


def main():
    response = supabase.table("vectors").select("name, embedding").execute()
    rows = response.data

    if not rows:
        print("No rows found in the vectors table.")
        sys.exit(1)

    target_row = next((r for r in rows if r["name"] == TARGET), None)
    if target_row is None:
        print(f"Error: '{TARGET}' not found in the vectors table.")
        sys.exit(1)

    target_vec = json.loads(target_row["embedding"]) if isinstance(target_row["embedding"], str) else target_row["embedding"]

    scores = []
    for row in rows:
        if row["name"] == TARGET:
            continue
        vec = json.loads(row["embedding"]) if isinstance(row["embedding"], str) else row["embedding"]
        score = weights(target_vec, vec)
        scores.append((row["name"], score))

#Reverse = True for descending order, False for ascending order
    scores.sort(key=lambda x: x[1], reverse=True)

    print(f"\nSimilarity to {TARGET}")
    print("=" * 40)
    for rank, (name, score) in enumerate(scores, start=1):
        print(f" {rank:2}. {name:<30} {score:.8f}")
    print()


if __name__ == "__main__":
    main()
