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

## In-App Purchase — War Room Pro

Guideline 3.1.1 requires digital content unlocked inside an iOS app to be sold
through Apple, so the native shell buys War Room Pro through StoreKit 2 while
the web build keeps using Stripe. Both write to the same `subscriptions` table,
so `isPro()` in `backend/routes/warroom.js` unlocks Pro without caring which
one paid.

| Piece | Where |
| --- | --- |
| Native StoreKit bridge | `frontend/ios/App/App/StoreKitPlugin.swift` |
| Web-side client | `frontend/src/iap.js` |
| Paywalls | `frontend/pro.html`, `frontend/src/components/WarRoomPage.jsx` |
| Verification + entitlement | `backend/routes/appleIap.js` |

The app never grants Pro on its own say-so. StoreKit hands back a signed
transaction (JWS), the backend re-verifies it against Apple's root certificate,
and only then is the entitlement written.

### 1. Create the subscription in App Store Connect

1. **Agreements, Tax, and Banking** → sign the **Paid Apps** agreement and fill
   in tax and banking. Until this is active, StoreKit returns *no products* and
   the paywall can't load a price. This is the single most common reason IAP
   "doesn't work".
2. **Your app → Subscriptions** → create a group (e.g. `War Room`), then a
   subscription inside it:
   - **Product ID:** `one.lstar.app.pro.monthly` — must match
     `PRO_PRODUCT_ID` in `frontend/src/iap.js` and `APPLE_PRO_PRODUCT_ID`
     on the server.
   - **Duration:** 1 month, **Price:** $0.99 (Apple's nearest tier to $1).
3. Add a localized display name, description, and a review screenshot.

### 2. Point the backend at Apple

```bash
APPLE_BUNDLE_ID=one.lstar.app
APPLE_PRO_PRODUCT_ID=one.lstar.app.pro.monthly
APPLE_APP_APPLE_ID=<numeric Apple ID from App Information>
# optional — defaults to backend/certs/apple
APPLE_ROOT_CA_DIR=/path/to/apple/roots
```

Then download Apple's root certificate as described in
`backend/certs/apple/README.md`. Without it the server refuses to verify
purchases rather than trusting the client.

### 3. Turn on App Store Server Notifications

App Store Connect → your app → **General → App Information → App Store Server
Notifications**. Set the **Version 2** production and sandbox URLs to:

```
https://www.lstar.one/api/billing/apple/notifications
```

This is what keeps Pro accurate after the sale — renewals, cancellations,
billing failures, refunds and expiries all arrive here rather than through the
app. Use **Send Test Notification** to confirm the endpoint answers 200.

### 4. Test in the sandbox

1. App Store Connect → **Users and Access → Sandbox → Test Accounts** — create
   one. Use an email you control that is *not* an existing Apple ID.
2. On the iPhone: **Settings → Developer → Sandbox Apple Account** and sign in
   as the tester. (Don't sign into the real App Store with it.)
3. Run the app from Xcode and buy. Sandbox subscriptions renew on an
   accelerated clock — a month becomes five minutes — so renewal and expiry
   notifications can be watched in minutes.

Renewals, refunds and Ask-to-Buy approvals arrive through
`Transaction.updates`, so the paywall updates without a relaunch.

### Things Apple checks on an IAP submission

- **Restore Purchases must exist and work.** Both paywalls render it inside
  the native shell; test it by deleting and reinstalling the app.
- **The price shown must match the storefront.** Both paywalls ask StoreKit
  for the localized price rather than printing `$1`.
- **Subscription terms must be visible at the point of purchase** — duration,
  price, auto-renewal — and the privacy policy and terms must be linked.
  `frontend/privacy.html` and `frontend/terms.html` are already in the build.
- **Reviewers need a working account.** Leave sandbox or demo credentials in
  App Review Information, since the War Room is behind sign-in.

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
