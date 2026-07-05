#!/usr/bin/env python3
"""Turn reviewed rows of leads.csv into personalized email drafts.

Only rows marked send=YES that have an email AND a personal_note become drafts.
Each draft is saved as its own .txt file in drafts/ — read it, then copy it into
your email app and send it yourself. Keep it to a handful a day.

Usage:
    python3 make_drafts.py --name "Your Name" --address "123 Main St, Dallas, TX 75201"
"""

import argparse
import csv
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "business"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--leads", default=HERE / "leads.csv")
    ap.add_argument("--template", default=HERE / "template.txt")
    ap.add_argument("--name", required=True, help="your real name for the signature")
    ap.add_argument("--address", required=True,
                    help="your real mailing address (required on commercial email by US law)")
    args = ap.parse_args()

    template = pathlib.Path(args.template).read_text(encoding="utf-8")
    out_dir = HERE / "drafts"
    out_dir.mkdir(exist_ok=True)

    made = skipped = 0
    with open(args.leads, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("send", "").strip().upper() != "YES":
                continue
            company = row.get("company", "").strip()
            email = row.get("email", "").strip()
            note = row.get("personal_note", "").strip()
            if not email or not note:
                print(f"  skipping {company or '?'}: needs both an email and a personal_note")
                skipped += 1
                continue
            body = template.format(
                company=company,
                category=row.get("category", "local").strip() or "local",
                personal_note=note,
                your_name=args.name,
                your_mailing_address=args.address,
            )
            path = out_dir / f"{slugify(company)}.txt"
            path.write_text(f"To: {email}\n{body}", encoding="utf-8")
            print(f"  wrote {path.name}  ->  {email}")
            made += 1

    if made == 0 and skipped == 0:
        sys.exit("No rows marked send=YES in leads.csv yet. Review some leads first.")
    print(f"\n{made} draft(s) in {out_dir}/ — read each one, then send it from your own email.")
    print("Tip: send a few per day, and personalize further if a draft feels generic.")


if __name__ == "__main__":
    main()
