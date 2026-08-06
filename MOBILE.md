# LoneStar AI — iOS App

The web app ships inside a native iOS shell via [Capacitor](https://capacitorjs.com).
The Xcode project lives in `frontend/ios/` and bundles the built web assets
(`frontend/dist/`); at runtime the app calls the production API at
`https://www.lstar.one` (auto-detected in `src/api.js` when running under
`capacitor://`).

## One-time setup (on a Mac)

1. Install [Xcode](https://apps.apple.com/us/app/xcode/id497799835) from the
   App Store, then the command line tools and CocoaPods:

   ```bash
   xcode-select --install
   sudo gem install cocoapods
   ```

2. Install JS deps and the pods:

   ```bash
   cd frontend
   npm install
   cd ios/App && pod install && cd ../..
   ```

## Build & run

```bash
cd frontend
npm run ios:build   # vite build + copy assets into the iOS project
npm run ios:open    # opens ios/App/App.xcworkspace in Xcode
```

In Xcode: pick a simulator (or your plugged-in iPhone) and press ▶︎ Run.
Re-run `npm run ios:build` any time the web code changes, then run again
from Xcode — no other steps.

## App identity

- **Bundle ID:** `one.lstar.app` (change in Xcode → App target → Signing &
  Capabilities if you prefer another)
- **Display name:** LoneStar AI
- **App icon:** replace the placeholder set in
  `frontend/ios/App/App/Assets.xcassets/AppIcon.appiconset/` — one 1024×1024
  PNG is enough; Xcode 15+ generates the rest.

## Shipping to the App Store

Everything below happens on the Mac. Budget an afternoon for the first
submission and 1–3 days for Apple's review.

### 1. Enrol ($99/yr, do this first — it can take a day to approve)

Join the [Apple Developer Program](https://developer.apple.com/programs/).
Individual enrolment needs a photo ID; you'll be asked to verify by phone.
Nothing else in this list works until the membership is active.

### 2. Register the app in App Store Connect

At [appstoreconnect.apple.com](https://appstoreconnect.apple.com) →
**My Apps → + → New App**:

- **Platform:** iOS
- **Name:** LoneStar AI (must be unique across the whole store)
- **Primary language:** English (U.S.)
- **Bundle ID:** `one.lstar.app` — pick it from the dropdown. If it isn't
  listed, create it first under
  [Certificates, Identifiers & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list).
- **SKU:** any private string, e.g. `lonestar-ai-ios`

### 3. Archive and upload the build

```bash
cd frontend
npm run ios:build   # vite build + cap sync — always re-run before archiving
npm run ios:open
```

In Xcode:

1. **Xcode → Settings → Accounts** — add your Apple ID, then in the **App**
   target → **Signing & Capabilities** tick *Automatically manage signing*
   and pick your team.
2. Set the run destination to **Any iOS Device (arm64)** — Archive is greyed
   out while a simulator is selected.
3. **Product → Archive**.
4. In Organizer: **Distribute App → App Store Connect → Upload**.

The build takes 10–30 minutes to finish processing before it shows up in
App Store Connect.

### 4. Test it on your own phone via TestFlight

In App Store Connect → **TestFlight**, add yourself as an internal tester
and install via the TestFlight app. Do this before submitting — it's the
same binary a reviewer gets, and it costs nothing to iterate.

### 5. Fill in the store listing

Under **Distribution**, Apple requires all of:

- **Screenshots** — 6.9" iPhone (1320×2868) at minimum; grab them from the
  simulator with **Cmd+S**. Others can be scaled from these.
- **Description, keywords, support URL, marketing URL** — support URL can be
  `https://www.lstar.one`.
- **Privacy policy URL** — `https://www.lstar.one/privacy.html`, already in
  the repo at `frontend/privacy.html`.
- **App Privacy questionnaire** — declare every category the backend
  collects. Answer this from what `backend/` actually stores, not from
  memory.
- **Age rating** questionnaire.
- **Export compliance** — already answered in `Info.plist` via
  `ITSAppUsesNonExemptEncryption = false` (the app only uses HTTPS, which is
  exempt), so no prompt should appear.

Then **Add for Review → Submit**.

### Known review risks for this app

- **Paid features must use In-App Purchase.** `frontend/pro.html` sells War
  Room Pro for $1/month through Stripe Checkout. Unlocking digital features
  inside an iOS app with an outside payment processor is a guideline 3.1.1
  rejection. Either hide the Pro upsell in the native shell, or implement
  StoreKit subscriptions. The relative `fetch("/api/billing/...")` in
  `pro.html` doesn't resolve under `capacitor://` anyway, so those buttons
  are already dead in the app.
- **Bare website wrappers get rejected** (4.2), but this app bundles its UI
  locally and only uses the network for data — that plus native touches
  (safe-area layout, offline-tolerant ticker fallbacks) is the standard
  Capacitor setup that passes. If a reviewer asks, describe it as a native
  shell over a first-party analytics product with a live data backend.
- **The backend must stay up through review.** If `https://www.lstar.one`
  is down or asleep when a reviewer opens the app, it reads as a broken
  app and gets rejected.
- **Gambling adjacency.** Odds and win probabilities are fine as analytics,
  but avoid any language that reads as betting advice, and keep
  `frontend/disclaimer.html` reachable from inside the app.

### Resubmitting after changes

Bump `CURRENT_PROJECT_VERSION` (build number) in Xcode for every upload —
App Store Connect rejects a duplicate. Bump `MARKETING_VERSION` (1.0 → 1.1)
only for a new public version.

## Notes

- `frontend/ios/App/App/public/` is generated by `cap sync` and gitignored —
  never edit it by hand.
- Push notifications, haptics, etc. can be added later via Capacitor plugins
  (`@capacitor/push-notifications`, `@capacitor/haptics`) without changing
  the web code's architecture.
