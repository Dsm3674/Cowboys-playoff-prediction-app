import UIKit
import Capacitor

/// Registers the app's own Capacitor plugins.
///
/// Capacitor only auto-registers plugins listed in `capacitor.config.json`'s
/// `packageClassList`, which `cap sync` generates from the plugin *packages* in
/// node_modules. A plugin that lives in this target is never in that list, so
/// without registering it here the bridge answers every call with
/// "plugin is not implemented on ios" — the class compiles and ships, it just
/// never gets hooked up.
///
/// Main.storyboard points at this class instead of CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(StoreKitPlugin())
    }
}
