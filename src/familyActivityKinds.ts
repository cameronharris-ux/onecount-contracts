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
 * Canonical kinds, by owning app and status. Statuses were re-graded by the
 * INDEPENDENT verification pass of 2026-07-07 (two manual reviewers + the
 * static-analysis gate `scripts/verify-event-taxonomy.mjs`; evidence in
 * reports/EVENT_TAXONOMY_VERIFICATION_2026-07-07.md). "LIVE" below means a
 * verified producer AND a verified kind-specific consumer/reactor — a kind
 * that is merely rendered by a generic activity feed does NOT count as LIVE.
 *
 *  - LIVE (producer + kind-specific consumer, both verified 2026-07-07):
 *      check.failed (Shield → Ops breach-task reactor) ·
 *      stocktake.finalized (OneCount → Ops variance tasks) ·
 *      shield.supplier_rejection (Shield → Shield cross-venue supplier risk) ·
 *      catalog.allergen_changed (OneCount → Shield allergen-drift inbound) ·
 *      recall.raised · recall.resolved (Trace → Shield recall inbound) ·
 *      ops.proof_required (Ops → Shield proof-obligation inbound) ·
 *      shield.proof_provided (Shield → Ops service-mode proof chip) ·
 *      ai.action.drafted · ai.action.applied · ai.action.dismissed
 *      (OneCount → OneCount action-log screen)
 *  - SIGNAL ONLY (producer live and verified; NO kind-specific consumer yet.
 *    Visible only where a generic activity feed exists — Ops and Shield —
 *    which renders any kind and proves nothing about reaction. Do not market
 *    or document these as cross-app behaviour until a reactor lands):
 *      incident.logged · check.resolved (consumed only as netting input to
 *      the check.failed breach reactor, no independent consumer) ·
 *      goods_received (Shield reads shield_receiving_context by column, not
 *      this event) · count.session_requested (intra-app sibling-device
 *      signal) · waste.logged · receiving.applied · receiving.captured ·
 *      handover.recorded · shield.excursion (the "recall compounding check"
 *      runs producer-side in Shield, not off this row) · shield.wastage
 *  - PLANNED (not live; do not document as shipped):
 *      variance.flagged (consumer pre-wired in Ops varianceTasks, no
 *      producer) · training.lapsed (producer builder exists but has ZERO
 *      call sites — dead code — and the claimed Ops recipe/prep gate does
 *      not exist) · corrective_action_draft_suggested (currently written to
 *      a Shield-local audit table, never reaches family_activity_events;
 *      spine emission unwired)
 *  - RETIRED: recall.initiated — no live producer since 2026-07-06 (Trace
 *    dab187b renamed to `recall.raised`). Kept in the list only so historical
 *    rows keep validating. Do not build anything against this kind.
 */
export const FAMILY_ACTIVITY_KINDS = [
  // Shield-emitted (live).
  "incident.logged", // SIGNAL ONLY · producer: Shield lib/domain/triggers.ts · no kind-specific consumer (generic feeds render it; verified 2026-07-07)
  "check.failed", // producer: Shield lib/db/correctiveActions.ts · consumer: Ops lib/ops/breachTasks.ts breach-task reactor (verified 2026-07-07)
  "check.resolved", // SIGNAL ONLY · producer: Shield lib/db/correctiveActions.ts · consumed only as netting input to the breach reactor, no independent consumer (verified 2026-07-07)
  "corrective_action_draft_suggested", // PLANNED for the spine · currently written to a Shield-local audit table (incidentEventsRepo), never reaches family_activity_events (verified 2026-07-07)
  // Inbound from OneCount receiving-context trigger (live, owner_app onecount).
  "goods_received", // SIGNAL ONLY · producer: OneCount (DB trigger on shield_receiving_context INSERT) · no consumer by kind — Shield reads shield_receiving_context directly (verified 2026-07-07)
  // OneCount-emitted (live).
  "count.session_requested", // SIGNAL ONLY · producer: OneCount lib/countSessionRequest.ts (app/(tabs)/scan.tsx) · intra-app signal, no cross-app consumer (verified 2026-07-07)
  "waste.logged", // SIGNAL ONLY · producer: OneCount lib/wasteLogs.ts · no kind-specific consumer (generic feeds only; verified 2026-07-07)
  "stocktake.finalized", // producer: OneCount lib/useFinalizeSession.ts · consumer: Ops variance tasks, family feed · drivers: payload.topVarianceDrivers
  "receiving.applied", // SIGNAL ONLY · producer: OneCount lib/invoiceApplyWorkflow.ts · no kind-specific consumer (generic feeds only; verified 2026-07-07)
  // Ops-emitted (live).
  "receiving.captured", // SIGNAL ONLY · producer: Ops components/receiving/ReceivingSheet.tsx · no kind-specific consumer (generic feeds only; verified 2026-07-07)
  "handover.recorded", // SIGNAL ONLY · producer: Ops hooks/useHandover.ts · no kind-specific consumer (generic feeds only; verified 2026-07-07)
  // Shield-emitted (live).
  "shield.excursion", // SIGNAL ONLY · producer: Shield lib/domain/triggers.ts · recall compounding check runs producer-side, not off this row; no cross-app consumer (verified 2026-07-07)
  "shield.supplier_rejection", // producer: Shield lib/onecount/supplierRejectionEmit.ts · consumer: Shield supplierRiskInbound.ts (per-supplier risk)
  // Planned — Ops producer not yet landed; OneCount const exists, unused by a producer.
  "variance.flagged",
  "catalog.allergen_changed", // producer: OneCount lib/catalog.ts (updateCatalogItemAllergens) · consumer: Shield lib/onecount/allergenDriftInbound.ts
  "recall.raised", // producer: Trace app/recall/new.tsx · consumer: Shield lib/onecount/recallInbound.ts
  "recall.resolved", // producer: Trace lib/db/workflows.ts (closeRecall) · consumer: Shield lib/onecount/recallInbound.ts
  // Shelf-life -> wastage-cost loop (Shield emits on a DISPOSED disposition).
  "shield.wastage", // SIGNAL ONLY · producer: Shield lib/onecount/wastageEmit.ts · no kind-specific consumer (generic feeds only; verified 2026-07-07)
  "ops.proof_required", // producer: Ops lib/ops/proofObligations.ts · consumer: Shield lib/onecount/proofObligationInbound.ts
  // Shield emits the captured proof back, keyed to the Ops requirement ref.
  "shield.proof_provided", // producer: Shield lib/onecount/proofObligationInbound.ts · consumer: Ops lib/ops/proofObligations.ts syncProofProvided → service-mode UI (verified 2026-07-07)
  // Training-currency signal — PLANNED, not live: the Shield producer
  // builder (lib/onecount/trainingLapsedEmit.ts emitTrainingLapsed) has zero
  // call sites outside its unit test, and no Ops recipe/prep gate exists
  // (verified 2026-07-07). Do not document as shipped.
  "training.lapsed", // PLANNED · producer dead code, no consumer (verified 2026-07-07)
  // AI draft_action audit trail (live, owner_app onecount).
  "ai.action.drafted", // producer: OneCount lib/actionAudit.ts · consumer: action-log screen, family feed
  "ai.action.applied", // producer: OneCount lib/actionAudit.ts · consumer: action-log screen, family feed
  "ai.action.dismissed", // producer: OneCount lib/actionAudit.ts · consumer: action-log screen, family feed
  // RETIRED 2026-07-06 — replaced by `recall.raised` (Trace dab187b). No live
  // producer; kept only so historical rows keep validating. Do not build a
  // new consumer against this kind.
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
