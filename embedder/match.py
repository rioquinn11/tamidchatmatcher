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

TARGET = "Dang Nguyen"




def weights(a: list[float], b: list[float]) -> float:
    #a = [0 if -0.05 < x < 0.05 else x for x in a]
    #b = [0 if -0.05 < x < 0.05 else x for x in b]


    return sum( (ai * bi)**2 for ai, bi in zip(a, b))


def main():
    response = supabase.table("profiles").select("name, embedding").execute()
    rows = response.data

    if not rows:
        print("No rows found in the vectors table.")
        sys.exit(1)

    target_row = next((r for r in rows if r["name"] == TARGET), None)
    if target_row is None:
        print(f"Error: '{TARGET}' not found in the vectors table.")
        sys.exit(1)

    target_vec = json.loads(target_row["embedding"]) if isinstance(target_row["embedding"], str) else target_row["embedding"]
    if target_vec is None:
        print(f"Error: '{TARGET}' has no embedding.")
        sys.exit(1)

    scores = []
    for row in rows:
        if row["name"] == TARGET:
            continue
        emb = row["embedding"]
        if emb is None:
            continue
        vec = json.loads(emb) if isinstance(emb, str) else emb
        if vec is None:
            continue
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
