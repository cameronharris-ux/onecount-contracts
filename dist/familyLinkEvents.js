"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAMILY_LINK_EVENTS_TABLE = void 0;
exports.familyLinkEventRow = familyLinkEventRow;
exports.FAMILY_LINK_EVENTS_TABLE = "family_link_events";
/** Build a price-free, org-scoped launcher-funnel row. */
function familyLinkEventRow(orgId, sourceApp, target, outcome) {
    return { org_id: orgId, source_app: sourceApp, target, outcome };
}
