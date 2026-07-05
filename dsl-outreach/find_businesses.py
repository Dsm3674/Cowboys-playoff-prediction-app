#!/usr/bin/env python3
"""Find local businesses with websites and save them to leads.csv.

Uses OpenStreetMap's free public data (Nominatim + Overpass) — no API key needed.
Businesses listed there have published their own name, website, and contact info.

Usage:
    python3 find_businesses.py --city "Dallas, TX" --radius 8
    python3 find_businesses.py --city "Plano, TX" --radius 5 --limit 40
"""

import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "DSL-Development-lead-finder/1.0 (small local web design studio)"

# Business types most likely to have dated websites and a budget for a redesign.
CATEGORY_TAGS = ["shop", "amenity", "office", "craft", "leisure", "tourism"]

# Chains and categories that won't buy a $700 site — skip them.
SKIP_CATEGORIES = {
    "bank", "atm", "fuel", "hospital", "school", "university", "police",
    "fire_station", "post_office", "townhall", "courthouse", "supermarket",
    "fast_food", "pharmacy", "parking", "place_of_worship", "library",
}


def http_get_json(url: str, params: dict) -> object:
    full = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(full, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.load(resp)


def geocode(city: str) -> tuple[float, float, str]:
    results = http_get_json(NOMINATIM_URL, {"q": city, "format": "json", "limit": 1})
    if not results:
        sys.exit(f"Could not find a place called {city!r}. Try 'City, State'.")
    r = results[0]
    return float(r["lat"]), float(r["lon"]), r["display_name"]


def find_businesses(lat: float, lon: float, radius_m: int) -> list[dict]:
    around = f"(around:{radius_m},{lat},{lon})"
    clauses = "\n".join(
        f'  nwr{around}["name"]["website"]["{tag}"];' for tag in CATEGORY_TAGS
    )
    query = f"[out:json][timeout:90];\n(\n{clauses}\n);\nout center tags;"
    data = http_get_json(OVERPASS_URL, {"data": query})

    leads, seen = [], set()
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        website = tags.get("website") or tags.get("contact:website") or ""
        category = next((tags[t] for t in CATEGORY_TAGS if t in tags), "")
        if not name or not website or category in SKIP_CATEGORIES:
            continue
        key = website.lower().rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        street = " ".join(
            x for x in (tags.get("addr:housenumber"), tags.get("addr:street")) if x
        )
        leads.append({
            "company": name,
            "category": category.replace("_", " "),
            "website": website,
            "phone": tags.get("phone") or tags.get("contact:phone") or "",
            "address": ", ".join(x for x in (street, tags.get("addr:city")) if x),
            # The business's own published contact email, when they list one.
            "email": tags.get("email") or tags.get("contact:email") or "",
            # Fill these two in yourself while you look at each website:
            "personal_note": "",
            "send": "",  # put YES here once you've reviewed the site and the draft
        })
    return leads


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--city", required=True, help='e.g. "Dallas, TX"')
    ap.add_argument("--radius", type=float, default=8, help="search radius in km")
    ap.add_argument("--limit", type=int, default=60, help="max businesses to keep")
    ap.add_argument("--out", default="leads.csv")
    args = ap.parse_args()

    print(f"Locating {args.city} ...")
    lat, lon, display = geocode(args.city)
    print(f"  -> {display}")
    time.sleep(1)  # be polite to the free API

    print(f"Searching businesses within {args.radius} km ...")
    leads = find_businesses(lat, lon, int(args.radius * 1000))[: args.limit]
    if not leads:
        sys.exit("No businesses with websites found. Try a bigger --radius.")

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(leads[0].keys()))
        writer.writeheader()
        writer.writerows(leads)

    with_email = sum(1 for l in leads if l["email"])
    print(f"\nSaved {len(leads)} businesses to {args.out} ({with_email} already list a public email).")
    print("Next steps:")
    print("  1. Open leads.csv in Excel/Sheets or Numbers.")
    print("  2. Visit each website. Delete rows that are a bad fit.")
    print("  3. For keepers: fill in 'email' (from their contact page) and write a")
    print("     one-sentence 'personal_note' about THEIR site. Put YES in 'send'.")
    print("  4. Run: python3 make_drafts.py")


if __name__ == "__main__":
    main()
