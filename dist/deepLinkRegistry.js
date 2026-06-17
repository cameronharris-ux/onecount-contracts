"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEB_HUB_FALLBACKS = exports.WEB_HUB_BASE = void 0;
exports.webFallbackForTarget = webFallbackForTarget;
/**
 * Canonical OneCount family deep-link registry. Maps each family app's
 * deep-link scheme to its OneCount web-hub equivalent, so an ecosystem CTA can
 * fall back to the web dashboard when the sibling app isn't installed.
 *
 * App-specific link TARGETS (which sibling an app links to) stay in each app's
 * ecosystemLinks module — only this scheme→web map is shared.
 */
exports.WEB_HUB_BASE = "https://onecount.ai";
exports.WEB_HUB_FALLBACKS = {
    onecountapp: `${exports.WEB_HUB_BASE}/dashboard/catalog`,
    onecount: `${exports.WEB_HUB_BASE}/dashboard/operations`,
    onecountops: `${exports.WEB_HUB_BASE}/dashboard/operations`,
    onecountshield: `${exports.WEB_HUB_BASE}/dashboard/compliance`,
    onecounttrace: `${exports.WEB_HUB_BASE}/dashboard/trace`,
    onecountplaybook: `${exports.WEB_HUB_BASE}/dashboard/recipes`,
};
/** The OneCount web-hub URL for a family deep-link target, or null if none maps. */
function webFallbackForTarget(target) {
    const scheme = target.split("://")[0];
    return exports.WEB_HUB_FALLBACKS[scheme] ?? null;
}
