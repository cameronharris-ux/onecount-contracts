/**
 * Canonical OneCount family entitlement contract.
 *
 * Rule the whole family obeys: the cross-app "OneCount Suite" bundle is a
 * SUPERSET of every per-app Pro entitlement (suite ⊇ pro). A live Suite
 * subscription unlocks Pro in any app, even though each app also sells its own
 * `pro` entitlement.
 */

/** This app's own Pro entitlement id (configured in the RevenueCat dashboard). */
export const PRO_ENTITLEMENT_ID = "pro";

/** The cross-app OneCount Suite entitlement id (the bundle superset). */
export const SUITE_ENTITLEMENT_ID = "suite";

/**
 * True when any active RevenueCat entitlement id grants Pro — either this app's
 * own Pro id OR the cross-app Suite bundle. Pass the keys of
 * `customerInfo.entitlements.active`.
 */
export function isProEntitlement(activeEntitlementIds: readonly string[]): boolean {
  return (
    activeEntitlementIds.includes(PRO_ENTITLEMENT_ID) ||
    activeEntitlementIds.includes(SUITE_ENTITLEMENT_ID)
  );
}
