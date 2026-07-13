"use strict";
/**
 * Canonical OneCount family product-identity map.
 *
 * PROMOTED (v0.4) from the Shield/Trace-local `lib/onecount/familyProvenance.ts`
 * copies (each carried a "SEAM" note marking `PRODUCT_COLOURS` for promotion
 * once a second sibling needed the exact same map — Trace was that second
 * sibling, so this module replaces both copies). Hex values match
 * onecount-site's `lib/ecosystem.ts` `rgb` fields (the site's `--oc-prod-*`
 * CSS tokens), which remain the ultimate source of truth for product colour.
 *
 * HARD RULE — identity, not chrome: `accent` is for small identity affordances
 * ONLY — a dot, an icon fill, a leading chip glyph — at ≤12% of the surface
 * it appears on. NEVER use it as a background, a button fill, or any other
 * form of chrome. These are "whose row is this" cues, not brand wallpaper.
 * A product's own accent must never be rendered as a self-dot next to its
 * own status chips (e.g. Shield never draws its own amber dot inside Shield;
 * see each app's `dotColourForOwnerApp`-style helper) — that stays app-local
 * because "self" depends on which app is rendering.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_IDENTITY = void 0;
exports.productIdentityForOwnerApp = productIdentityForOwnerApp;
exports.accentForOwnerApp = accentForOwnerApp;
exports.labelForOwnerApp = labelForOwnerApp;
exports.PRODUCT_IDENTITY = {
    onecount: { slug: "onecount", name: "OneCount", accent: "#00D68F" }, // emerald
    ops: { slug: "ops", name: "OneCount Ops", accent: "#56A9FF" }, // cyan
    shield: { slug: "shield", name: "OneCount Shield", accent: "#FFB224" }, // amber
    trace: { slug: "trace", name: "OneCount Trace", accent: "#2DD4BF" }, // teal
    pulse: { slug: "pulse", name: "OneCount Pulse", accent: "#A78BFA" },
};
/** Normalises a raw `owner_app` string, folding the legacy `playbook` alias to `ops`. */
function normalizeOwnerApp(ownerApp) {
    const key = ownerApp.trim().toLowerCase();
    if (key === "playbook")
        return "ops";
    return key in exports.PRODUCT_IDENTITY ? key : null;
}
/**
 * The product identity for a raw `owner_app` value, or `null` when unknown.
 * Folds the legacy `playbook` alias to `ops`. Never throws.
 */
function productIdentityForOwnerApp(ownerApp) {
    const key = normalizeOwnerApp(ownerApp);
    return key ? exports.PRODUCT_IDENTITY[key] : null;
}
/**
 * The identity accent hex for a raw `owner_app` value, or `null` when unknown.
 * Callers should render nothing when this returns `null` — never fall back to
 * a guess colour. Callers that must not self-dot (see HARD RULE above) filter
 * out their own app's slug before calling this.
 */
function accentForOwnerApp(ownerApp) {
    return productIdentityForOwnerApp(ownerApp)?.accent ?? null;
}
/** Human label for an `owner_app` value, falling back to the raw string when unknown. */
function labelForOwnerApp(ownerApp) {
    return productIdentityForOwnerApp(ownerApp)?.name ?? ownerApp;
}
