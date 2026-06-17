/**
 * Canonical OneCount family deep-link registry. Maps each family app's
 * deep-link scheme to its OneCount web-hub equivalent, so an ecosystem CTA can
 * fall back to the web dashboard when the sibling app isn't installed.
 *
 * App-specific link TARGETS (which sibling an app links to) stay in each app's
 * ecosystemLinks module — only this scheme→web map is shared.
 */
export const WEB_HUB_BASE = "https://onecount.ai";

export const WEB_HUB_FALLBACKS: Record<string, string> = {
  onecountapp: `${WEB_HUB_BASE}/dashboard/catalog`,
  onecount: `${WEB_HUB_BASE}/dashboard/operations`,
  onecountops: `${WEB_HUB_BASE}/dashboard/operations`,
  onecountshield: `${WEB_HUB_BASE}/dashboard/compliance`,
  onecounttrace: `${WEB_HUB_BASE}/dashboard/trace`,
  onecountplaybook: `${WEB_HUB_BASE}/dashboard/recipes`,
};

/** The OneCount web-hub URL for a family deep-link target, or null if none maps. */
export function webFallbackForTarget(target: string): string | null {
  const scheme = target.split("://")[0];
  return WEB_HUB_FALLBACKS[scheme] ?? null;
}
