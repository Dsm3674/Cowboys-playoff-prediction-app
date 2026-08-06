#!/bin/bash
# ============================================================
# Fetch Apple's root certificate for In-App Purchase verification.
#
# routes/appleIap.js verifies the signed transactions StoreKit sends from the
# iOS app by walking the certificate chain back to an Apple root, so the root
# has to be on disk. Hosts like Railway rebuild the container on every deploy,
# which is why this runs from `postinstall` rather than being committed.
#
# Never fails the install. A missing certificate disables IAP verification
# (the route answers 503 and says so) — it does not make the server unsafe,
# and taking down a deploy over a transient network blip would be worse.
# ============================================================

CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/certs/apple"
CERT_PATH="$CERT_DIR/AppleRootCA-G3.cer"
CERT_URL="https://www.apple.com/certificateauthority/AppleRootCA-G3.cer"

mkdir -p "$CERT_DIR"

if curl -fsSL -o "$CERT_PATH" "$CERT_URL" && [ -s "$CERT_PATH" ]; then
  echo "[apple-iap] Apple root CA ready at $CERT_PATH"
  exit 0
fi

# A failed download can still leave a truncated or empty file behind, and an
# unparseable certificate is worse than none — remove it.
rm -f "$CERT_PATH"
echo "[apple-iap] WARNING: could not fetch the Apple root CA from $CERT_URL"
echo "[apple-iap] In-App Purchase verification stays disabled until"
echo "[apple-iap] $CERT_DIR contains it. See certs/apple/README.md."
exit 0
