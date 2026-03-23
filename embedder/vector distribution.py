import sys
import os
import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

BINS = 30


def main():
    response = supabase.table("vectors").select("name, embedding").execute()
    rows = response.data

    if not rows:
        print("No rows found in the vectors table.")
        sys.exit(1)

    n = len(rows)
    cols = 3
    rows_count = math.ceil(n / cols)

    fig, axes = plt.subplots(rows_count, cols, figsize=(cols * 5, rows_count * 3))
    axes = axes.flatten() if n > 1 else [axes]

    for i, row in enumerate(rows):
        vec = json.loads(row["embedding"]) if isinstance(row["embedding"], str) else row["embedding"]
        ax = axes[i]
        ax.hist(vec, bins=BINS, color="steelblue", edgecolor="white", linewidth=0.4)
        ax.set_title(row["name"], fontsize=9, fontweight="bold")
        ax.set_xlabel("Value", fontsize=7)
        ax.set_ylabel("Count", fontsize=7)
        ax.tick_params(labelsize=6)

    for j in range(i + 1, len(axes)):
        axes[j].set_visible(False)

    fig.suptitle("Vector Value Distribution per Entry", fontsize=13, fontweight="bold", y=1.01)
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
