/**
 * Canonical OneCount family deep-link registry. Maps each family app's
 * deep-link scheme to its OneCount web-hub equivalent, so an ecosystem CTA can
 * fall back to the web dashboard when the sibling app isn't installed.
 *
 * App-specific link TARGETS (which sibling an app links to) stay in each app's
 * ecosystemLinks module — only this scheme→web map is shared.
 */
export declare const WEB_HUB_BASE = "https://onecount.ai";
export declare const WEB_HUB_FALLBACKS: Record<string, string>;
/** The OneCount web-hub URL for a family deep-link target, or null if none maps. */
export declare function webFallbackForTarget(target: string): string | null;
