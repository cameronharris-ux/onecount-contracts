/**
 * Canonical taxonomy of cross-app `family_activity_events` kinds.
 *
 * The `kind` column on the shared `family_activity_events` table is plain
 * text, so without a shared vocabulary every app invents its own strings and
 * the consumer side has nothing to switch on. This module is the PROMOTED
 * (v0.4) source of truth — it replaces the Shield-local
 * `lib/onecount/familyActivityKinds.ts` copy that carried the "SEAM" note
 * marking it for promotion into `@onecount/contracts`.
 *
 * Kind-string shape: `domain.thing.verb` in past tense (e.g.
 * `incident.logged`, `check.resolved`). A few early kinds predate this
 * convention and ship as bare verbs (`goods_received`,
 * `corrective_action_draft_suggested`) — kept verbatim since renaming a live
 * wire value is a breaking change, not a lint fix.
 *
 * Resilience contract: the helpers below NEVER throw and the normaliser
 * tolerates unknown / legacy free-text kinds (returns them verbatim). A
 * consumer must keep working when it meets a kind a newer producer emits
 * before this taxonomy is updated here.
 */
/** Bump when the kind vocabulary changes; lets consumers reason about drift. */
export declare const FAMILY_ACTIVITY_TAXONOMY_VERSION: "onecount.family-activity/v1";
/**
 * Canonical kinds, by owning app and status:
 *
 *  - REAL, emitted by Shield (owner_app `shield`):
 *      incident.logged · check.failed · check.resolved ·
 *      corrective_action_draft_suggested · shield.wastage ·
 *      shield.proof_provided · training.lapsed
 *  - REAL, emitted by OneCount (owner_app `onecount`):
 *      goods_received (the receiving-context DB trigger fires this on
 *      shield_receiving_context INSERT) · count.session_requested (the
 *      cross-device "please count this venue" request, shipped 2026-07 —
 *      see one-count-app's `lib/countSessionRequest.ts`)
 *  - PLANNED (consumers can switch on them before producers are wired):
 *      shield.excursion · shield.supplier_rejection · catalog.allergen_changed ·
 *      recall.raised · recall.resolved · ops.proof_required
 */
export declare const FAMILY_ACTIVITY_KINDS: readonly ["incident.logged", "check.failed", "check.resolved", "corrective_action_draft_suggested", "goods_received", "count.session_requested", "shield.excursion", "shield.supplier_rejection", "catalog.allergen_changed", "recall.raised", "recall.resolved", "shield.wastage", "ops.proof_required", "shield.proof_provided", "training.lapsed"];
export type FamilyActivityKind = (typeof FAMILY_ACTIVITY_KINDS)[number];
/** The four apps that can own a family-activity row (`owner_app` column). */
export type FamilyActivityOwnerApp = "onecount" | "ops" | "shield" | "trace";
/** Severity of a family-activity row; drives status-chip colour, never identity. */
export type FamilyActivitySeverity = "info" | "warning" | "critical";
/** True when `kind` is part of the canonical taxonomy. Never throws. */
export declare function isKnownFamilyActivityKind(kind: string): kind is FamilyActivityKind;
/**
 * Normalise a raw kind string off the wire. Trims whitespace and returns the
 * value AS-IS — known or not. Unknown / legacy free-text kinds are preserved
 * so the feed never drops an event just because this taxonomy hasn't caught
 * up yet. Never throws; an empty/whitespace string normalises to ""
 * (callers decide).
 */
export declare function normalizeFamilyActivityKind(kind: string): string;
