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
 * Canonical kinds, by owning app and status. This is a ground-truth sweep
 * (grep across all four app repos' producers + inbound consumers, 2026-07-06 —
 * hospitality-os-2026-07 quick-win #4/#12) — every LIVE entry below has a
 * verified producer and every consumer note has a verified call site.
 *
 *  - LIVE, emitted by Shield (owner_app `shield`):
 *      incident.logged · check.failed · check.resolved ·
 *      corrective_action_draft_suggested · shield.wastage ·
 *      shield.excursion · shield.supplier_rejection · training.lapsed ·
 *      shield.proof_provided (consumes ops.proof_required, replies keyed to it)
 *  - LIVE, emitted by OneCount (owner_app `onecount`):
 *      goods_received (the receiving-context DB trigger fires this on
 *      shield_receiving_context INSERT) · count.session_requested ·
 *      waste.logged · stocktake.finalized · receiving.applied
 *  - LIVE, emitted by Ops (owner_app `ops`):
 *      receiving.captured · handover.recorded
 *  - LIVE as of 2026-07-06 (the hospitality-os quick-win pass connected the
 *    dead pairs the same day this registry landed):
 *      catalog.allergen_changed (producer: OneCount lib/catalog.ts) ·
 *      recall.raised · recall.resolved (producer: Trace app/recall/new.tsx +
 *      lib/db/workflows.ts closeRecall) · ops.proof_required (producer: Ops
 *      lib/ops/proofObligations.ts) ·
 *      ai.action.drafted · ai.action.applied · ai.action.dismissed
 *      (producer: OneCount lib/actionAudit.ts — the draft_action audit log)
 *  - PLANNED (consumer already wired, producer not yet landed):
 *      variance.flagged (Ops-side const `VARIANCE_FLAGGED_KIND` defined but
 *      unused by a producer)
 *  - RETIRED: recall.initiated — no live producer since 2026-07-06 (Trace
 *    dab187b renamed to `recall.raised`). Kept in the list only so historical
 *    rows keep validating. Do not build anything against this kind.
 */
export declare const FAMILY_ACTIVITY_KINDS: readonly ["incident.logged", "check.failed", "check.resolved", "corrective_action_draft_suggested", "goods_received", "count.session_requested", "waste.logged", "stocktake.finalized", "receiving.applied", "receiving.captured", "handover.recorded", "shield.excursion", "shield.supplier_rejection", "variance.flagged", "catalog.allergen_changed", "recall.raised", "recall.resolved", "shield.wastage", "ops.proof_required", "shield.proof_provided", "training.lapsed", "ai.action.drafted", "ai.action.applied", "ai.action.dismissed", "recall.initiated"];
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
