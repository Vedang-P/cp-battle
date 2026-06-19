#!/usr/bin/env python3
"""
Download and filter Codeforces problems from open-r1/codeforces dataset.

Filters:
  - Rating 800-1200 (easy problems)
  - stdio input mode
  - No interactive problems
  - No generated checker (custom checker required)
  - At least 5 official test cases

Output: /tmp/cf_problems.json

Usage:
  pip install datasets
  python3 scripts/download-codeforces.py
"""

import json
import sys
from datasets import load_dataset

def main():
    print("Loading open-r1/codeforces dataset...")
    ds = load_dataset("open-r1/codeforces", split="train")
    print(f"Total problems in dataset: {len(ds)}")

    filtered = []
    for row in ds:
        rating = row.get("rating") or 0
        if not (800 <= rating <= 1200):
            continue
        if row.get("input_mode") != "stdio":
            continue
        if row.get("interaction_format") is not None:
            continue
        if row.get("generated_checker") is not None:
            continue
        official = row.get("official_tests") or []
        if len(official) < 5:
            continue
        filtered.append(row)

    print(f"Problems matching criteria: {len(filtered)}")

    if len(filtered) < 200:
        print(f"Warning: Only {len(filtered)} problems found with rating 800-1200 and 5+ tests")
        print("Consider expanding rating range to 800-1400")

    # Take top 200 by most test cases (for best coverage)
    filtered.sort(key=lambda x: len(x.get("official_tests", [])), reverse=True)
    filtered = filtered[:200]

    # Convert to JSON-friendly format
    output = []
    for row in filtered:
        output.append({
            "id": row.get("id", ""),
            "contest_id": row.get("contest_id", ""),
            "index": row.get("index", ""),
            "title": row.get("title", ""),
            "description": row.get("description", ""),
            "input_format": row.get("input_format", ""),
            "output_format": row.get("output_format", ""),
            "note": row.get("note"),
            "time_limit": row.get("time_limit", 2.0),
            "memory_limit": row.get("memory_limit", 256),
            "rating": row.get("rating", 800),
            "tags": list(row.get("tags", [])),
            "official_tests": row.get("official_tests", []),
            "official_tests_complete": row.get("official_tests_complete", False),
            "examples": row.get("examples", []),
            "input_mode": row.get("input_mode", "stdio"),
            "generated_checker": row.get("generated_checker"),
            "interaction_format": row.get("interaction_format"),
        })

    with open("/tmp/cf_problems.json", "w") as f:
        json.dump(output, f)

    print(f"Saved {len(output)} problems to /tmp/cf_problems.json")

    # Print some stats
    ratings = [row.get("rating", 0) for row in filtered]
    test_counts = [len(row.get("official_tests", [])) for row in filtered]
    print(f"\nRating range: {min(ratings)}-{max(ratings)}")
    print(f"Test cases: min={min(test_counts)}, max={max(test_counts)}, avg={sum(test_counts)/len(test_counts):.1f}")

    # Show sample problem titles
    print("\nSample problems:")
    for row in filtered[:10]:
        print(f"  - {row.get('title', 'Unknown')} (rating={row.get('rating')}, tests={len(row.get('official_tests', []))})")


if __name__ == "__main__":
    main()
