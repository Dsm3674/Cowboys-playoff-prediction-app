# Apple root certificates

`routes/appleIap.js` verifies the signed transactions StoreKit sends from the
iOS app. That verification walks the certificate chain back to an Apple root,
so the root has to be on disk — without it, IAP verification is disabled and
`/api/billing/apple/verify` answers 503 rather than trusting the client.

`npm install` in `backend/` fetches it automatically via the `postinstall`
script (`scripts/fetch-apple-root-ca.sh`), which is how it gets onto hosts like
Railway that rebuild the container on every deploy. To fetch it by hand:

```bash
bash scripts/fetch-apple-root-ca.sh
# or, equivalently
curl -O https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
```

The download never fails the install — a blocked network disables IAP
verification, which the route reports plainly, rather than taking down a
deploy. If purchases start coming back 503, check the build log for
`[apple-iap] WARNING`.

Any `.cer`, `.pem`, `.der` or `.crt` file in this directory is loaded, so you
can drop in additional roots if Apple rotates them. `APPLE_ROOT_CA_DIR`
overrides the location — useful on a host where the app directory is read-only.

These are public certificates, not secrets. They're kept out of git only
because a vendored copy tends to go stale silently; fetching it as part of
deployment keeps it honest.

Verify what you downloaded before trusting it:

```bash
openssl x509 -inform der -in AppleRootCA-G3.cer -noout -subject -fingerprint -sha256
# subject=C=US, O=Apple Inc., OU=Apple Certification Authority, CN=Apple Root CA - G3
```
