import Foundation
import Capacitor
import StoreKit

/// Bridges StoreKit 2 to the web layer so War Room Pro can be sold through
/// Apple's In-App Purchase system, which guideline 3.1.1 requires for digital
/// content unlocked inside the app. The web build keeps using Stripe.
///
/// Every method that reports an entitlement also hands back the transaction's
/// JWS representation — a signed payload the backend re-verifies against
/// Apple before granting Pro, so a tampered client can't unlock anything.
@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise)
    ]

    /// Renewals, refunds, Ask-to-Buy approvals and purchases made on another
    /// device arrive here rather than through `purchase`. Finishing them and
    /// telling the web layer keeps the paywall honest without a relaunch.
    private var updatesTask: Task<Void, Never>?

    override public func load() {
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self = self else { return }
                guard case .verified(let transaction) = result else { continue }
                await transaction.finish()
                self.notifyListeners("entitlementChanged", data: [
                    "jws": result.jwsRepresentation,
                    "productId": transaction.productID,
                    "originalTransactionId": String(transaction.originalID),
                    "revoked": transaction.revocationDate != nil
                ])
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    // MARK: - Product lookup

    @objc func getProduct(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId is required")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    // Usually means the product isn't approved yet, the paid
                    // apps agreement isn't signed, or the ID doesn't match
                    // App Store Connect.
                    call.reject("No StoreKit product found for \(productId)")
                    return
                }
                call.resolve([
                    "productId": product.id,
                    "displayName": product.displayName,
                    "description": product.description,
                    "displayPrice": product.displayPrice,
                    "price": NSDecimalNumber(decimal: product.price).doubleValue
                ])
            } catch {
                call.reject("Could not load products: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Purchase

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId is required")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("No StoreKit product found for \(productId)")
                    return
                }

                // The account token lets App Store Server Notifications name
                // the LoneStar identity on later renewals. Only a real UUID is
                // accepted, so callers that have no UUID simply omit it and the
                // backend falls back to the mapping it stored at first verify.
                var options: Set<Product.PurchaseOption> = []
                if let token = call.getString("appAccountToken"),
                   let uuid = UUID(uuidString: token) {
                    options.insert(.appAccountToken(uuid))
                }

                let result = try await product.purchase(options: options)
                switch result {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        call.reject("Apple could not verify this purchase.")
                        return
                    }
                    await transaction.finish()
                    call.resolve([
                        "status": "purchased",
                        "jws": verification.jwsRepresentation,
                        "productId": transaction.productID,
                        "transactionId": String(transaction.id),
                        "originalTransactionId": String(transaction.originalID)
                    ])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                case .pending:
                    // Ask to Buy / SCA. The transaction shows up later through
                    // the Transaction.updates listener above.
                    call.resolve(["status": "pending"])
                @unknown default:
                    call.resolve(["status": "unknown"])
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Restore

    /// Apple requires a way to restore purchases on a new device. `AppStore.sync`
    /// prompts for the App Store password, so a cancelled prompt is not an
    /// error — we still report whatever entitlement is already on the device.
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
            } catch {
                CAPLog.print("[StoreKit] AppStore.sync did not complete: \(error.localizedDescription)")
            }
            call.resolve(await entitlementPayload(productId: call.getString("productId")))
        }
    }

    @objc func currentEntitlement(_ call: CAPPluginCall) {
        Task {
            call.resolve(await entitlementPayload(productId: call.getString("productId")))
        }
    }

    /// Deep-links to the system subscription management sheet so cancelling
    /// doesn't require hunting through Settings.
    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("No active window scene.")
                return
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                call.reject("Could not open subscription settings: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Helpers

    /// The device's current view of what's owned. Authoritative enough to draw
    /// the UI immediately; the backend still re-verifies the JWS before it
    /// unlocks anything server-side.
    private func entitlementPayload(productId: String?) async -> [String: Any] {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            if transaction.revocationDate != nil { continue }
            if let wanted = productId, transaction.productID != wanted { continue }

            var payload: [String: Any] = [
                "active": true,
                "jws": result.jwsRepresentation,
                "productId": transaction.productID,
                "transactionId": String(transaction.id),
                "originalTransactionId": String(transaction.originalID)
            ]
            if let expires = transaction.expirationDate {
                payload["expiresAt"] = ISO8601DateFormatter().string(from: expires)
            }
            return payload
        }
        return ["active": false]
    }
}
