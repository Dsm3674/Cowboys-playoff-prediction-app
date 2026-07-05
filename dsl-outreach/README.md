# DSL Development — client outreach kit

Finds local businesses that have websites, then generates a personalized email
draft for each one you approve. You review every draft and send it yourself
from your own email — that's what keeps this normal sales outreach instead of
spam, and it's also what gets replies.

No API keys needed. Uses OpenStreetMap's free public business directory.

## 1. Find businesses near you

```bash
python3 find_businesses.py --city "Dallas, TX" --radius 8
```

Creates `leads.csv` with company name, category, website, phone, and (when the
business publishes one) their contact email.

## 2. Review the leads

Open `leads.csv` in Excel or Google Sheets. For each business:

- Visit their website. If it's already great, or they're a big chain, delete the row.
- If they're a good fit: paste their **email** (from their contact page) into the
  `email` column, and write one honest sentence about *their* site in
  `personal_note` — e.g. "I noticed the menu page doesn't load on mobile."
  This sentence is what makes the email feel human. Don't skip it.
- Put `YES` in the `send` column.

## 3. Generate drafts

```bash
python3 make_drafts.py --name "Your Name" --address "Your mailing address"
```

One `.txt` file per approved lead appears in `drafts/`. Read each one, copy it
into Gmail, and send.

## Rules that keep you out of trouble (and out of spam folders)

- **You press send.** Never wire this up to auto-send.
- **Small batches** — a handful a day. Gmail suspends accounts that blast.
- **Real name and mailing address** in every email, and honor any
  "unsubscribe" reply immediately. US law (CAN-SPAM) requires all three
  for commercial email.
- One follow-up max if they don't reply. Then move on.
