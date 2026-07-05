/**
 * Canonical OneCount family deep-link registry. Maps each family app's
 * deep-link scheme to its OneCount web-hub equivalent, so an ecosystem CTA can
 * fall back to the web dashboard when the sibling app isn't installed.
 *
 * App-specific link TARGETS (which sibling an app links to) stay in each app's
 * ecosystemLinks module — only this scheme→web map is shared.
 *
 * One canonical scheme per app (verified against each app's `app.config.js`
 * as of v0.4):
 *   - onecountapp    — OneCount (inventory)
 *   - onecount       — Ops (Ops's own config declares `["lastcall","onecount"]`;
 *                       `onecount` is the canonical family-facing scheme)
 *   - onecountshield — Shield
 *   - onecounttrace  — Trace
 *
 * `onecountops` is NOT a real app scheme — no app.config.js declares it as its
 * own `scheme`. It only ever appears in `LSApplicationQueriesSchemes` arrays
 * (Shield/Trace query it defensively). Kept as a fallback alias, pointing at
 * the same page as `onecount`, so a stray query never dead-ends.
 *
 * `onecountplaybook` is RETIRED as an app scheme (Ops absorbed Playbook,
 * 2026-06 consolidation) but is NOT dead: Playbook/Shield/Trace's
 * `lib/onecount/ecosystemLinks.ts` still build and query
 * `onecountplaybook://` as an outbound CTA target (verified by repo grep,
 * 2026-07). Kept here as a legacy-redirect fallback only — do not treat it as
 * a first-class scheme in new code; new CTAs should target `onecount` (Ops)
 * directly. Remove this entry once those three `ecosystemLinks.ts` copies are
 * updated to stop emitting it.
 */
export declare const WEB_HUB_BASE = "https://onecount.ai";
export declare const WEB_HUB_FALLBACKS: Record<string, string>;
/** The OneCount web-hub URL for a family deep-link target, or null if none maps. */
export declare function webFallbackForTarget(target: string): string | null;
/**
 * Trace QR/deep-link grammar (verified against
 * OneCount-Trace/lib/domain/qr.ts). Every Trace label can carry a QR that
 * deep-links into the Trace app; siblings that scan or receive a Trace QR
 * payload (e.g. via a shared scan sheet) can use these to recognise and parse
 * it without depending on Trace's app code.
 *
 *   onecounttrace://b/<batchId>[?c=<shortCode>]   batch / label lookup
 *   onecounttrace://r/<recallId>                  recall notice
 *   onecounttrace://p/<productId>                 product rules & history
 */
export declare const TRACE_QR_SCHEME = "onecounttrace";
export type TraceQrTarget = {
    kind: "batch";
    batchId: string;
    shortCode?: string;
} | {
    kind: "recall";
    recallId: string;
} | {
    kind: "product";
    productId: string;
};
/** Parses any Trace QR payload (or deep link). Null = not a Trace payload. */
export declare function parseTraceQr(payload: string): TraceQrTarget | null;
