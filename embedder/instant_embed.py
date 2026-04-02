"""Embed a fixed sentence and print the vector to stdout (OpenAI text-embedding-3-small)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

SENTENCE = "Hello from Tamid Chat Matcher instant embed."

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

    print(f"dimensions: {len(embedding)}")
    print(json.dumps(embedding, indent=2))


if __name__ == "__main__":
    main()
