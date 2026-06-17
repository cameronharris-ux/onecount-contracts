/**
 * Canonical OneCount family entitlement contract.
 *
 * Rule the whole family obeys: the cross-app "OneCount Suite" bundle is a
 * SUPERSET of every per-app Pro entitlement (suite ⊇ pro). A live Suite
 * subscription unlocks Pro in any app, even though each app also sells its own
 * `pro` entitlement.
 */
/** This app's own Pro entitlement id (configured in the RevenueCat dashboard). */
export declare const PRO_ENTITLEMENT_ID = "pro";
/** The cross-app OneCount Suite entitlement id (the bundle superset). */
export declare const SUITE_ENTITLEMENT_ID = "suite";
/**
 * True when any active RevenueCat entitlement id grants Pro — either this app's
 * own Pro id OR the cross-app Suite bundle. Pass the keys of
 * `customerInfo.entitlements.active`.
 */
export declare function isProEntitlement(activeEntitlementIds: readonly string[]): boolean;
