/**
 * Cross-app launcher funnel contract.
 *
 * Each app's ecosystem launcher computes a three-way outcome when the user taps a
 * sibling-app CTA — the sibling opened, the web hub opened as fallback, or neither
 * (not installed). `not_installed` is the family's highest-intent install signal.
 * This module is the shared, pure shape of a funnel event row written to the
 * org-scoped `family_link_events` table. Each app keeps its own best-effort emit
 * wrapper (its Supabase client + session + org resolution) and builds the row here.
 */

export const FAMILY_LINK_EVENTS_TABLE = "family_link_events";

export type FamilyLinkOutcome = "opened_app" | "web_fallback" | "not_installed";

export type FamilyLinkSourceApp = "playbook" | "onecount" | "ops" | "shield" | "trace";

export interface FamilyLinkEventRow {
  org_id: string;
  source_app: FamilyLinkSourceApp;
  target: string;
  outcome: FamilyLinkOutcome;
}

/** Build a price-free, org-scoped launcher-funnel row. */
export function familyLinkEventRow(
  orgId: string,
  sourceApp: FamilyLinkSourceApp,
  target: string,
  outcome: FamilyLinkOutcome
): FamilyLinkEventRow {
  return { org_id: orgId, source_app: sourceApp, target, outcome };
}
