import { registerPlugin } from "@capacitor/core";
import { BASE_URL } from "./api.js";

// ---------------------------------------------------------------------------
// War Room Pro on iOS.
//
// Apple's guideline 3.1.1 requires digital content unlocked inside an iOS app
// to be sold through In-App Purchase, so the native shell buys through
// StoreKit while the web build keeps using Stripe. Everything here is inert
// on the web — `isNativeShell()` is the switch every caller checks first.
//
// StoreKit alone only proves something to the device. Pro is granted by the
// backend, which re-verifies the signed transaction against Apple, so the
// purchase has to survive a round trip before any feature unlocks.
// ---------------------------------------------------------------------------

/// Must match the product ID created in App Store Connect and the backend's
/// APPLE_PRO_PRODUCT_ID.
export const PRO_PRODUCT_ID = "one.lstar.app.pro.monthly";

const StoreKit = registerPlugin("StoreKit");

/// True inside the Capacitor iOS app, where the page is served from
/// capacitor:// rather than https://. Same scheme test api.js uses to pick the
/// production API host.
export function isNativeShell() {
  return (
    typeof window !== "undefined" &&
    /^(capacitor|ionic|file):/.test(window.location.protocol)
  );
}

/// The App Store's own localised price string ("$0.99", "£0.99", …). Apple
/// requires the price shown to match the storefront, so never hardcode it in
/// native builds — fall back only if StoreKit is unreachable.
export async function getProPrice() {
  if (!isNativeShell()) return null;
  try {
    const product = await StoreKit.getProduct({ productId: PRO_PRODUCT_ID });
    return product.displayPrice || null;
  } catch (err) {
    console.warn("[iap] product lookup failed:", err.message);
    return null;
  }
}

/// Hands a signed transaction to the backend, which verifies it with Apple and
/// records the entitlement against the signed-in identity.
async function verifyWithServer(jws, user) {
  const res = await fetch(`${BASE_URL}/api/billing/apple/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-lonestar-user": user } : {})
    },
    body: JSON.stringify({ jws, user: user || "" })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not confirm your purchase with the server.");
  }
  return data;
}

/// Runs the App Store purchase sheet. Resolves with `{ status }` for the
/// outcomes that aren't a completed sale, so callers can tell a cancellation
/// from a failure and stay quiet about the former.
export async function purchasePro(user) {
  if (!isNativeShell()) throw new Error("In-App Purchase is only available in the iOS app.");

  const result = await StoreKit.purchase({ productId: PRO_PRODUCT_ID });

  if (result.status === "cancelled") return { status: "cancelled", pro: false };
  // Ask to Buy and other deferred approvals finish later; the entitlement
  // listener below picks them up without the user re-tapping.
  if (result.status === "pending") return { status: "pending", pro: false };
  if (result.status !== "purchased" || !result.jws) {
    return { status: result.status || "failed", pro: false };
  }

  const verified = await verifyWithServer(result.jws, user);
  return { status: "purchased", ...verified };
}

/// Apple requires a way to restore purchases on a new device or after a
/// reinstall — this backs the "Restore Purchases" control.
export async function restorePro(user) {
  if (!isNativeShell()) throw new Error("Restoring is only available in the iOS app.");

  const entitlement = await StoreKit.restore({ productId: PRO_PRODUCT_ID });
  if (!entitlement.active || !entitlement.jws) {
    return { pro: false, status: "none" };
  }
  return verifyWithServer(entitlement.jws, user);
}

/// Re-links the device's entitlement to the signed-in account. Worth calling on
/// launch and after sign-in: it's how a subscription bought before signing in,
/// or on another device, gets attached to the right identity.
export async function syncEntitlement(user) {
  if (!isNativeShell()) return { pro: false, status: "none" };
  try {
    const entitlement = await StoreKit.currentEntitlement({ productId: PRO_PRODUCT_ID });
    if (!entitlement.active || !entitlement.jws) return { pro: false, status: "none" };
    return await verifyWithServer(entitlement.jws, user);
  } catch (err) {
    console.warn("[iap] entitlement sync failed:", err.message);
    return { pro: false, status: "unknown" };
  }
}

/// Fires on renewals, refunds, Ask-to-Buy approvals, and purchases made on
/// another device. Returns an unsubscribe function.
export function onEntitlementChanged(handler) {
  if (!isNativeShell()) return () => {};
  const listener = StoreKit.addListener("entitlementChanged", handler);
  return () => {
    Promise.resolve(listener)
      .then((l) => l && l.remove())
      .catch(() => {});
  };
}

/// Opens the system subscription-management sheet, so cancelling doesn't mean
/// digging through Settings.
export async function openManageSubscriptions() {
  if (!isNativeShell()) {
    window.open("https://apps.apple.com/account/subscriptions", "_blank");
    return;
  }
  await StoreKit.manageSubscriptions();
}
