"""Embed a fixed sentence; print the first 4 dimensions to 3 decimal places (text-embedding-3-small)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

SENTENCE = "バスケットボールをするのが好きです"

MODEL = "text-embedding-3-small"


def main() -> None:
    if not OPENAI_API_KEY:
        print(
            "Error: Missing OPENAI_API_KEY (set in .env or environment).",
            file=sys.stderr,
        )
        sys.exit(1)

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.embeddings.create(model=MODEL, input=SENTENCE)
    embedding = response.data[0].embedding

    first_four = embedding[:4]
    print(" ".join(f"{x:.4f}" for x in first_four))


if __name__ == "__main__":
    main()
