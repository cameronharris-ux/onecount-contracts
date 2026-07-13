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
export type OwnerApp = "onecount" | "ops" | "shield" | "trace" | "pulse";
/**
 * `playbook` is a legacy `owner_app` alias: Ops absorbed Playbook in the
 * 2026-06 consolidation, but historical rows and any lagging producer may
 * still stamp `owner_app: "playbook"`. It maps to the same identity as `ops`.
 */
export type LegacyOwnerApp = OwnerApp | "playbook";
export interface ProductIdentity {
    slug: OwnerApp;
    /** Display name for chips, labels, and the "from <name>" provenance grammar. */
    name: string;
    /** Identity accent hex — dots/icon-fills only, ≤12% of surface. Never chrome. */
    accent: string;
}
export declare const PRODUCT_IDENTITY: Record<OwnerApp, ProductIdentity>;
/**
 * The product identity for a raw `owner_app` value, or `null` when unknown.
 * Folds the legacy `playbook` alias to `ops`. Never throws.
 */
export declare function productIdentityForOwnerApp(ownerApp: string): ProductIdentity | null;
/**
 * The identity accent hex for a raw `owner_app` value, or `null` when unknown.
 * Callers should render nothing when this returns `null` — never fall back to
 * a guess colour. Callers that must not self-dot (see HARD RULE above) filter
 * out their own app's slug before calling this.
 */
export declare function accentForOwnerApp(ownerApp: string): string | null;
/** Human label for an `owner_app` value, falling back to the raw string when unknown. */
export declare function labelForOwnerApp(ownerApp: string): string;
