"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRACE_QR_SCHEME = exports.WEB_HUB_FALLBACKS = exports.WEB_HUB_BASE = void 0;
exports.webFallbackForTarget = webFallbackForTarget;
exports.parseTraceQr = parseTraceQr;
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
 *   - onecountpulse  — Pulse
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
exports.WEB_HUB_BASE = "https://onecount.ai";
exports.WEB_HUB_FALLBACKS = {
    onecountapp: `${exports.WEB_HUB_BASE}/dashboard/catalog`,
    onecount: `${exports.WEB_HUB_BASE}/dashboard/operations`,
    onecountops: `${exports.WEB_HUB_BASE}/dashboard/operations`,
    onecountshield: `${exports.WEB_HUB_BASE}/dashboard/compliance`,
    onecounttrace: `${exports.WEB_HUB_BASE}/dashboard/trace`,
    onecountpulse: exports.WEB_HUB_BASE,
    /** @deprecated legacy-redirect only — see header note. Still emitted by 3 apps. */
    onecountplaybook: `${exports.WEB_HUB_BASE}/dashboard/operations`,
};
/** The OneCount web-hub URL for a family deep-link target, or null if none maps. */
function webFallbackForTarget(target) {
    const scheme = target.split("://")[0];
    return exports.WEB_HUB_FALLBACKS[scheme] ?? null;
}
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
exports.TRACE_QR_SCHEME = "onecounttrace";
/** Reads a single `key=value` pair out of a raw (already-split) query string. Avoids a URLSearchParams/DOM-lib dependency — this package targets plain ES2020. */
function readQueryParam(query, key) {
    for (const pair of query.split("&")) {
        if (!pair)
            continue;
        const eq = pair.indexOf("=");
        const k = eq === -1 ? pair : pair.slice(0, eq);
        if (k !== key)
            continue;
        const v = eq === -1 ? "" : pair.slice(eq + 1);
        return decodeURIComponent(v);
    }
    return undefined;
}
/** Parses any Trace QR payload (or deep link). Null = not a Trace payload. */
function parseTraceQr(payload) {
    const m = payload
        .trim()
        .match(/^onecounttrace:\/\/([brp])\/([^?]+)(?:\?(.*))?$/i);
    if (!m)
        return null;
    const kind = m[1].toLowerCase();
    const id = decodeURIComponent(m[2]);
    if (!id)
        return null;
    if (kind === "b") {
        const code = readQueryParam(m[3] ?? "", "c");
        return { kind: "batch", batchId: id, ...(code ? { shortCode: code } : {}) };
    }
    if (kind === "r")
        return { kind: "recall", recallId: id };
    if (kind === "p")
        return { kind: "product", productId: id };
    return null;
}
