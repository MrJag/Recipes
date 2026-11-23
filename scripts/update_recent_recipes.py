#!/usr/bin/env python3
"""Update the homepage's recently added recipes from Git addition history."""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "src/data/recent-recipes.json"
history = subprocess.check_output(
    ["git", "log", "--diff-filter=A", "--name-only", "--pretty=format:", "--", "recipes"],
    cwd=ROOT,
    text=True,
)
results = []
seen = set()
for raw_path in history.splitlines():
    path = raw_path.strip()
    if not re.fullmatch(r"recipes/[^/]+/[^/]+\\.json", path) or path in seen:
        continue
    seen.add(path)
    source = ROOT / path
    if not source.is_file():
        continue
    try:
        data = json.loads(source.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        continue
    slug = data.get("id") or source.stem
    if not isinstance(slug, str) or not slug:
        continue
    photo = data.get("photo")
    if isinstance(photo, str) and photo and (ROOT / photo.removeprefix("./")).is_file():
        image = photo
    else:
        image = next(
            (f"./public/images/{slug}.{ext}"
             for ext in ("jpg", "jpeg", "png", "webp")
             if (ROOT / f"public/images/{slug}.{ext}").is_file()),
            None,
        )
    raw_description = data.get("subtitle") or data.get("headnote") or ""
    description = " ".join(str(raw_description).split())
    if description.upper().startswith("DRAFT") or description.upper().startswith("UNTESTED"):
        description = ""
    if len(description) > 125:
        sentence = re.split(r"(?<=[.!?])\\s+", description, maxsplit=1)[0]
        description = sentence if len(sentence) <= 145 else description[:122].rsplit(" ", 1)[0] + "…"
    results.append({
        "slug": slug,
        "title": data.get("title") or slug.replace("-", " ").title(),
        "description": description or "Recently added to the cookbook.",
        "photo": image,
        "draft": data.get("status") == "draft",
    })
    if len(results) == 3:
        break

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(
    json.dumps({"recipes": results}, indent=2, ensure_ascii=False) + "\\n",
    encoding="utf-8",
)
print("Updated recent recipe cards:", ", ".join(r["slug"] for r in results))
