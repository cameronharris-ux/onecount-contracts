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
export const FAMILY_ACTIVITY_TAXONOMY_VERSION = "onecount.family-activity/v1" as const;

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
 *  - PLANNED (consumer already wired, producer not yet landed — verified no
 *    producer call site exists anywhere in the four repos as of this sweep):
 *      variance.flagged (Ops-side const `VARIANCE_FLAGGED_KIND` defined but
 *      unused by a producer) · catalog.allergen_changed (OneCount owns
 *      cloud_catalog_items, will be the producer) · recall.raised ·
 *      recall.resolved (Trace owns recalls; Shield's recallInbound.ts already
 *      consumes both) · ops.proof_required (Ops owns CCP proof asks; Shield's
 *      proofObligationInbound.ts already consumes it)
 *  - DEPRECATED: recall.initiated — Trace's `app/recall/new.tsx` emits this
 *    today, but Shield's consumer (recallInbound.ts) switches on
 *    `recall.raised` / `recall.resolved`, not this string. Replaced by
 *    `recall.raised`; Trace's producer is a separate follow-up fix, not this
 *    registry.
 */
export const FAMILY_ACTIVITY_KINDS = [
  // Shield-emitted (live).
  "incident.logged", // producer: Shield lib/domain/triggers.ts · consumer: family feed UI (all apps)
  "check.failed", // producer: Shield lib/db/correctiveActions.ts · consumer: family feed UI (all apps)
  "check.resolved", // producer: Shield lib/db/correctiveActions.ts · consumer: family feed UI (all apps)
  "corrective_action_draft_suggested", // producer: Shield lib/domain/triggers.ts · consumer: family feed UI (all apps)
  // Inbound from OneCount receiving-context trigger (live, owner_app onecount).
  "goods_received", // producer: OneCount (DB trigger on shield_receiving_context INSERT) · consumer: Shield/Trace receiving evidence
  // OneCount-emitted (live).
  "count.session_requested", // producer: OneCount lib/countSessionRequest.ts (app/(tabs)/scan.tsx) · consumer: sibling device requesting a count
  "waste.logged", // producer: OneCount lib/wasteLogs.ts · consumer: Ops/Shield/Trace family feed (waste-cost visibility)
  "stocktake.finalized", // producer: OneCount lib/useFinalizeSession.ts · consumer: Ops variance tasks, family feed
  "receiving.applied", // producer: OneCount lib/invoiceApplyWorkflow.ts · consumer: Ops/Shield/Trace family feed
  // Ops-emitted (live).
  "receiving.captured", // producer: Ops components/receiving/ReceivingSheet.tsx · consumer: family feed UI (all apps)
  "handover.recorded", // producer: Ops hooks/useHandover.ts · consumer: family feed UI (all apps)
  // Shield-emitted (live).
  "shield.excursion", // producer: Shield lib/domain/triggers.ts · consumer: recall compounding check, family feed
  "shield.supplier_rejection", // producer: Shield lib/onecount/supplierRejectionEmit.ts · consumer: Shield supplierRiskInbound.ts (per-supplier risk)
  // Planned — Ops producer not yet landed; OneCount const exists, unused by a producer.
  "variance.flagged",
  // Planned — OneCount owns cloud_catalog_items, will be the producer.
  "catalog.allergen_changed", // consumer (live): Shield lib/onecount/allergenDriftInbound.ts
  // Planned — Trace owns recalls; producer not yet landed (Trace still emits
  // the deprecated `recall.initiated` — see note above).
  "recall.raised", // consumer (live): Shield lib/onecount/recallInbound.ts
  "recall.resolved", // consumer (live): Shield lib/onecount/recallInbound.ts
  // Shelf-life -> wastage-cost loop (Shield emits on a DISPOSED disposition).
  "shield.wastage", // producer: Shield lib/onecount/wastageEmit.ts · consumer: family feed UI (all apps)
  // Planned — Ops owns CCP proof asks; producer not yet landed.
  "ops.proof_required", // consumer (live): Shield lib/onecount/proofObligationInbound.ts
  // Shield emits the captured proof back, keyed to the Ops requirement ref.
  "shield.proof_provided", // producer: Shield lib/onecount/proofObligationInbound.ts · consumer: Ops (displays returned proof)
  // Training-currency signal. Shield EMITS when required training / FSS
  // currency lapses; siblings gate recipe/prep on it (recipe gate is
  // sibling-side).
  "training.lapsed", // producer: Shield lib/onecount/trainingLapsedEmit.ts · consumer: Ops recipe/prep gate
  // DEPRECATED — replaced by `recall.raised`. Trace's app/recall/new.tsx still
  // emits this string; kept here (not deleted) so the normaliser/type stay
  // truthful about what is actually on the wire until Trace's producer fix
  // lands. Do not build a new consumer against this kind.
  "recall.initiated",
] as const;

export type FamilyActivityKind = (typeof FAMILY_ACTIVITY_KINDS)[number];

/** The four apps that can own a family-activity row (`owner_app` column). */
export type FamilyActivityOwnerApp = "onecount" | "ops" | "shield" | "trace";

/** Severity of a family-activity row; drives status-chip colour, never identity. */
export type FamilyActivitySeverity = "info" | "warning" | "critical";

const KNOWN_KINDS: ReadonlySet<string> = new Set(FAMILY_ACTIVITY_KINDS);

/** True when `kind` is part of the canonical taxonomy. Never throws. */
export function isKnownFamilyActivityKind(kind: string): kind is FamilyActivityKind {
  return KNOWN_KINDS.has(kind);
}

/**
 * Normalise a raw kind string off the wire. Trims whitespace and returns the
 * value AS-IS — known or not. Unknown / legacy free-text kinds are preserved
 * so the feed never drops an event just because this taxonomy hasn't caught
 * up yet. Never throws; an empty/whitespace string normalises to ""
 * (callers decide).
 */
export function normalizeFamilyActivityKind(kind: string): string {
  return typeof kind === "string" ? kind.trim() : "";
}
