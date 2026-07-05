"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAMILY_ACTIVITY_KINDS = exports.FAMILY_ACTIVITY_TAXONOMY_VERSION = void 0;
exports.isKnownFamilyActivityKind = isKnownFamilyActivityKind;
exports.normalizeFamilyActivityKind = normalizeFamilyActivityKind;
/** Bump when the kind vocabulary changes; lets consumers reason about drift. */
exports.FAMILY_ACTIVITY_TAXONOMY_VERSION = "onecount.family-activity/v1";
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
exports.FAMILY_ACTIVITY_KINDS = [
    // Shield-emitted (live).
    "incident.logged",
    "check.failed",
    "check.resolved",
    "corrective_action_draft_suggested",
    // Inbound from OneCount receiving-context trigger (live, owner_app onecount).
    "goods_received",
    // OneCount-emitted (live) — cross-device count-session request.
    "count.session_requested",
    // Planned — Shield producers land in a later slice.
    "shield.excursion",
    "shield.supplier_rejection",
    "catalog.allergen_changed",
    // Planned — recall fan-out (consumers/producers in a later slice).
    "recall.raised",
    "recall.resolved",
    // Shelf-life -> wastage-cost loop (Shield emits on a DISPOSED disposition).
    "shield.wastage",
    // Ops CCP -> Shield proof obligation. Shield CONSUMES the Ops requirement
    // and EMITS the captured proof back, keyed to the Ops requirement.
    "ops.proof_required",
    "shield.proof_provided",
    // Training-currency signal. Shield EMITS when required training / FSS
    // currency lapses; siblings gate recipe/prep on it (recipe gate is
    // sibling-side).
    "training.lapsed",
];
const KNOWN_KINDS = new Set(exports.FAMILY_ACTIVITY_KINDS);
/** True when `kind` is part of the canonical taxonomy. Never throws. */
function isKnownFamilyActivityKind(kind) {
    return KNOWN_KINDS.has(kind);
}
/**
 * Normalise a raw kind string off the wire. Trims whitespace and returns the
 * value AS-IS — known or not. Unknown / legacy free-text kinds are preserved
 * so the feed never drops an event just because this taxonomy hasn't caught
 * up yet. Never throws; an empty/whitespace string normalises to ""
 * (callers decide).
 */
function normalizeFamilyActivityKind(kind) {
    return typeof kind === "string" ? kind.trim() : "";
}
