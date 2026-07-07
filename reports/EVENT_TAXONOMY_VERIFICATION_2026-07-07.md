# Event Taxonomy Verification — 2026-07-07

**Independent verification pass (WS5).** This report was produced by static
analysis of the four sibling app repos plus this contracts package, run
*separately* from the pipeline that authored `src/familyActivityKinds.ts` and
its 2026-07-06 "3 dead pairs reconnected" claim. Findings below are backed by
`file:line` evidence, cross-checked by two independent methods (manual
`Read`/`Grep` by two separate reviewers, plus the dependency-free script this
report ships alongside) that converged on identical results.

- **Script**: `scripts/verify-event-taxonomy.mjs` (Node stdlib only, no deps)
- **Taxonomy under test**: `src/familyActivityKinds.ts`, `@onecount/contracts@0.5.1`
- **Repos inspected**:
  - Contracts/taxonomy: `/Users/cameronharris/Project/onecount-contracts`
  - OneCount (owner_app `onecount`): `/Users/cameronharris/Project/One-Count/one-count-app`
  - Ops/Playbook (owner_app `ops`): `/Users/cameronharris/Project/OneCount-Playbook`
  - Shield (owner_app `shield`): `/Users/cameronharris/Project/OneCount-Shield`
  - Trace (owner_app `trace`): `/Users/cameronharris/Project/OneCount-Trace`
- **Script run**: `node scripts/verify-event-taxonomy.mjs` from this repo,
  exit code **1** (mismatches found — this is expected and correct; see
  verdicts below). Full run log reproduced at the end of this report.

## Headline verdict

Of 25 kinds in the canonical taxonomy: **9 PASS** (live producer + live
reactor-level consumer), **1 PASS** as correctly-PLANNED (`variance.flagged`),
**1 PASS** as correctly-RETIRED (`recall.initiated`), **12 FAIL**. None of the
12 FAILs are false alarms from this script's own extraction bugs — every one
was independently confirmed by direct file reads (two reviewers) before being
accepted into this report; see "How the script was hardened" below for the
false-positive traps that were found and closed during development.

The three flagship cross-app features named in the audit brief are addressed
individually below. **Two of three are genuinely live** (recall reactor,
proof-obligation handshake). **The allergen-drift cascade is genuinely live
too** (a fourth "critical pair," `catalog.allergen_changed`, also passes).
`check.failed`/`check.resolved` is **split**: the raise side is wired
end-to-end, the resolve side is not.

---

## Critical pairs (named in the audit brief)

### 1. Recall reactor — `recall.raised` / `recall.resolved` — **PASS (both)**

| Kind | Producer (file:line) | Consumer (file:line) |
|---|---|---|
| `recall.raised` | Trace, `app/recall/new.tsx:142-143` — `kind: RECALL_RAISED_KIND` (const `"recall.raised"` defined `lib/onecount/familyActivity.ts:30`), inside `void publishFamilyActivity({...})` | Shield, `lib/onecount/recallInbound.ts:93` — `fetchFamilyActivity({ kinds: [RECALL_RAISED_KIND], ... })` (const `RECALL_RAISED_KIND = "recall.raised"` at `recallInbound.ts:28`) |
| `recall.resolved` | Trace, `lib/db/workflows.ts:783-784`, inside `closeRecall()` (starts `:739`) — `kind: RECALL_RESOLVED_KIND` (const `"recall.resolved"` at `lib/onecount/familyActivity.ts:31`) | Shield, `lib/onecount/recallInbound.ts:94` — `fetchFamilyActivity({ kinds: [RECALL_RESOLVED_KIND], ... })` (const at `recallInbound.ts:29`) |

Both events share `sourceRef` = `` `trace:recall:${recallId}` `` (built by
`recallSourceRef()`, `lib/onecount/familyActivity.ts:34-36`), which is exactly
the mechanism Shield's reactor needs to net a raise against its matching
resolve. This is a real fix: git history confirms Trace commit `dab187b`
(2026-07-06, "fix: emit recall.raised/recall.resolved (was recall.initiated)")
renamed the producer from a kind Shield's consumer never matched
(`recall.initiated`) to the two kinds it does. **Verdict: PASS, genuinely
reconnected.**

Legacy kind `recall.initiated` (RETIRED per taxonomy): confirmed **zero live
occurrences** anywhere in Trace source — the only hit for that string
anywhere in the repo is an explanatory comment inside
`tests/familyActivityKindDrift.test.ts:8-10` describing the historical bug.
Retirement claim holds.

### 2. Allergen-drift cascade — `catalog.allergen_changed` — **PASS**

| Producer | Consumer |
|---|---|
| OneCount, `lib/catalog.ts:1579-1580`, inside `updateCatalogItemAllergens()` (starts `:1549`) — `kind: "catalog.allergen_changed" satisfies FamilyActivityKind` | Shield, `lib/onecount/allergenDriftInbound.ts:96-97` — `fetchFamilyActivity({ kinds: [CATALOG_ALLERGEN_CHANGED_KIND] })` (const `CATALOG_ALLERGEN_CHANGED_KIND = "catalog.allergen_changed"` at `:38`) |

Exact string match on both sides, server-side kind-filtered consumer.
**Verdict: PASS.**

### 3. Proof-obligation handshake — `ops.proof_required` / `shield.proof_provided` — **PASS (both directions)**

| Kind | Producer (file:line) | Consumer (file:line) |
|---|---|---|
| `ops.proof_required` | Ops, `lib/ops/proofObligations.ts:95` (builder `buildProofRequiredEvent`, starts `:79`) → emitted via `const input = buildProofRequiredEvent(...); await publishFamilyActivity(input);` at `:121-123` | Shield, `lib/onecount/proofObligationInbound.ts:236` — `fetchFamilyActivity({ kinds: [PROOF_REQUIRED_KIND] })`; also a post-fetch check `event.kind !== PROOF_REQUIRED_KIND` at `:115` |
| `shield.proof_provided` | Shield, `lib/onecount/proofObligationInbound.ts:200` (builder `buildProofProvidedEvent`, starts `:194`) → emitted via `const input: FamilyActivityInput = buildProofProvidedEvent(check, requirementRef); await publishFamilyActivity(input);` at `:306-307` | Ops, `lib/ops/proofObligations.ts:163` — `syncProofProvided()` filters `e.kind !== PROOF_PROVIDED_KIND` (const `PROOF_PROVIDED_KIND = "shield.proof_provided"` at `:47`), surfaced via `refreshProofProvided()` (`:182-189`) into the service-mode UI |

Both legs key off a shared `requirementRef`/`sourceRef` (Ops builds it via
`proofRequirementRef()`; Shield recovers it via
`requirementRefFromTemplateId()`, `proofObligationInbound.ts:320`, which
parses the `ops_proof:`-prefixed check id Ops embeds). **Verdict: PASS,
genuinely a two-way handshake, not just one leg.**

### 4. `check.failed` / `check.resolved` — **SPLIT: raise PASS, resolve FAIL**

| Kind | Producer (file:line) | Consumer (file:line) |
|---|---|---|
| `check.failed` | Shield, `lib/db/correctiveActions.ts:97`, via builder `correctiveActionFamilyEvent()` (returns `kind: "check.failed"` at `:22`) | Ops, `lib/ops/breachTasks.ts:91` — `buildBreachTasks()` filters `e.kind !== BREACH_KIND` (const `BREACH_KIND = "check.failed"` at `:21`) against the **unfiltered** feed `useFamilyActivity()` returns at the caller, `app/(tabs)/index.tsx:296` |
| `check.resolved` | Shield, `lib/db/correctiveActions.ts:103,136`, via builder `correctiveActionResolvedEvent()` (returns `kind: "check.resolved"` at `:51`) | **NOT FOUND.** `breachTasks.ts` does reference a `RESOLVED_KINDS` set containing the literal `"check.resolved"` (`:32`), but that set is used only to net an *existing* breach off the "Do this next" list, not as an independent reactor outcome — for the purposes of this taxonomy's "does something react to this event" test, no OTHER cross-app behaviour keys off `check.resolved` alone. It is only ever read by the SAME reactor already counted under `check.failed`, so it doesn't add an independent PASS. |

Practically: `check.failed` genuinely drives the Ops "B3" breach-task reactor.
`check.resolved` only nets an entry off that same reactor's list — there is
no other cross-app consumer of a resolved-check signal anywhere in the four
repos (e.g. no family-feed-independent audit, no Trace/OneCount consumer).
Whether this counts as a "real pair" depends on how strictly "consumer" is
defined; this report takes the strict reading (an event needs its own
independent consumption path to PASS) and marks it FAIL, but flags that this
is the closest call in the whole sweep — reasonable people could count the
`RESOLVED_KINDS.has()` reference as sufficient and call it PASS.

---

## Full verdict table (all 25 taxonomy kinds)

| Kind | Status (taxonomy) | Verdict | Evidence / reason |
|---|---|---|---|
| `incident.logged` | documented (LIVE) | **FAIL** | Producer: Shield `lib/domain/triggers.ts:168-169` (inline `kind: "incident.logged"`). No reactor consumer found anywhere. Only surfaced via Shield's own generic feed screen `app/family-connections.tsx:63` (a display-label map with a raw-string fallback — renders it, reacts to nothing). |
| `check.failed` | documented (LIVE) | **PASS** | See critical pair #4 above. |
| `check.resolved` | documented (LIVE) | **FAIL** | See critical pair #4 above — nets off the same reactor, no independent consumer. |
| `corrective_action_draft_suggested` | documented (LIVE) | **FAIL** | The literal string is written by Shield's `triggers.ts:211` via `incidentEventsRepo.record({ kind: "corrective_action_draft_suggested", ... })` — a call into a **Shield-local audit table** (not `family_activity_events`; Shield's own `supabase/migrations` folder is empty per its own README, and this table does not appear in the one-count-app-owned schema baseline). It never reaches the shared cross-app table at all. The taxonomy entry is simply wrong for this kind. |
| `goods_received` | documented (LIVE) | **FAIL** | Producer: OneCount DB trigger `emit_receiving_activity_event()`, `supabase/migrations/20260616120438_family_activity_from_receiving.sql:13-19` (`AFTER INSERT ON shield_receiving_context`). The taxonomy claims "consumer: Shield/Trace receiving evidence" — but the literal string `"goods_received"` appears **nowhere** in Shield or Trace source; Shield's actual receiving flow (`lib/onecount/receivingInbound.ts`) reads `shield_receiving_context` directly by column, not by matching this kind. Only reachable via the two repos' generic feed screens (raw-string fallback), never a dedicated reactor. |
| `count.session_requested` | documented (LIVE) | **FAIL** | Producer: OneCount, builder `buildCountSessionRequestActivity`, called `app/(tabs)/scan.tsx:747` (const `COUNT_SESSION_REQUESTED_KIND` at `lib/countSessionRequest.ts:5`). No consumer anywhere — this is a same-org, sibling-device signal (intra-app), not actually meant for cross-app reaction; taxonomy's inclusion here is arguably a category error. |
| `waste.logged` | documented (LIVE) | **FAIL** | Producer: OneCount `lib/wasteLogs.ts:491-492`. No reactor consumer anywhere in Ops/Shield/Trace despite the taxonomy's "consumer: Ops/Shield/Trace family feed (waste-cost visibility)" note — only reachable via the generic feed screens. |
| `stocktake.finalized` | documented (LIVE) | **PASS** | Producer: OneCount `lib/useFinalizeSession.ts:217-227` (payload includes `topVarianceDrivers`, computed `:205-208`). Consumer: Ops `lib/ops/varianceTasks.ts:133`, `VARIANCE_KINDS.has(e.kind)` where the set includes `VARIANCE_KIND = "stocktake.finalized"` (`:31`) — the variance-to-task reactor. |
| `receiving.applied` | documented (LIVE) | **FAIL** | Producer: OneCount `lib/invoiceApplyWorkflow.ts:145-146` — note the call is `deps.publishFamilyActivity?.({...})` (dependency-injected + optional-chained; this script had to be specifically hardened to still recognise this shape, see below). No reactor consumer anywhere; generic-feed-only. |
| `receiving.captured` | documented (LIVE) | **FAIL** | Producer: Ops `components/receiving/ReceivingSheet.tsx:119-120`. No reactor consumer anywhere; generic-feed-only. |
| `handover.recorded` | documented (LIVE) | **FAIL** | Producer: Ops `hooks/useHandover.ts:98-99`. No reactor consumer anywhere; generic-feed-only. |
| `shield.excursion` | documented (LIVE) | **FAIL** | Producer: Shield, builder `buildExcursionActivityInput` (`lib/domain/triggers.ts:248-317`, `kind: "shield.excursion"` at `:274`), called from `emitExcursion` (`:307-319`). The taxonomy's own comment claims a "recall compounding check" consumer — that logic (`isExcursionUnderRecall`, `triggers.ts:261-264`) is real, but it runs **inside the same producer file**, comparing the excursion against Shield's own in-memory `openRecalls` list — it is not a cross-app consumer of the `family_activity_events` row at all. No sibling repo reacts to this kind. |
| `shield.supplier_rejection` | documented (LIVE) | **PASS** | Producer: Shield `lib/onecount/supplierRejectionEmit.ts:73-74` (const `SUPPLIER_REJECTION_KIND` imported from `lib/domain/supplierRisk.ts:25`). Consumer: Shield's own `lib/onecount/supplierRiskInbound.ts:51-52` (`fetchFamilyActivity({ kinds: [SUPPLIER_REJECTION_KIND] })`) — this is genuinely cross-**venue** (org-scoped), not same-venue self-consumption: a rejection logged at one venue warns a sibling venue in the same org. Legitimate pattern. |
| `variance.flagged` | documented as PLANNED | **PASS** | Correctly PLANNED: no producer anywhere (confirmed — `VARIANCE_FLAGGED_KIND` const at Ops `lib/ops/varianceTasks.ts:33` has no `.insert()`/`publishFamilyActivity` call site using it anywhere in the repo, only a unit-test mock). Consumer pre-wired: `varianceTasks.ts:133`'s `VARIANCE_KINDS` set already includes it, ready for the day a producer lands. |
| `catalog.allergen_changed` | documented (LIVE) | **PASS** | See critical pair #2 above. |
| `recall.raised` | documented (LIVE) | **PASS** | See critical pair #1 above. |
| `recall.resolved` | documented (LIVE) | **PASS** | See critical pair #1 above. |
| `shield.wastage` | documented (LIVE) | **FAIL** | Producer: Shield, builder `buildWastageEvent` (`lib/onecount/wastageEmit.ts`, `kind: "shield.wastage"` resolved via const at line 32), called from `lib/db/foodDisposition.ts:104` inside `if (evidence.action === "discarded")` (a real, reachable conditional — confirmed this is NOT dead code, unlike `training.lapsed` below). No reactor consumer anywhere; generic-feed-only despite the taxonomy's "consumer: family feed UI (all apps)" note. |
| `ops.proof_required` | documented (LIVE) | **PASS** | See critical pair #3 above. |
| `shield.proof_provided` | documented (LIVE) | **PASS** | See critical pair #3 above. |
| `training.lapsed` | documented (LIVE) | **FAIL** | Producer: Shield, builder `buildTrainingLapsedEvent` (`lib/onecount/trainingLapsedEmit.ts:77`), wired to `publishFamilyActivity` inside `emitTrainingLapsed()` (`:104`). **`emitTrainingLapsed` has zero call sites anywhere in Shield outside its own unit test** (`tests/trainingCurrency.test.ts`) — this producer is dead code, never invoked from any screen or flow. The taxonomy's claimed consumer ("Ops recipe/prep gate") also does not exist: `training.lapsed` and `TRAINING_LAPSED` have **zero matches anywhere in OneCount-Playbook**. Both ends of this pair are fictitious as currently documented. |
| `ai.action.drafted` | documented (LIVE) | **PASS** | Producer: OneCount `lib/actionAudit.ts:53-54` (`ACTION_AUDIT_KINDS.drafted`, object defined `:23-27`). Consumer: `lib/actionAudit.ts:126` — `listActionAuditLog()` queries `family_activity_events` directly via `.from(FAMILY_ACTIVITY_EVENTS_TABLE).in("kind", ACTION_AUDIT_KIND_LIST)` (`ACTION_AUDIT_KIND_LIST = Object.values(ACTION_AUDIT_KINDS)`, `:111`) for the action-log screen. Self-contained within OneCount, but genuinely produced and genuinely consumed. |
| `ai.action.applied` | documented (LIVE) | **PASS** | Same mechanism as `ai.action.drafted`; emit at `lib/actionAudit.ts:69-70`. |
| `ai.action.dismissed` | documented (LIVE) | **PASS** | Same mechanism; emit at `lib/actionAudit.ts:84-85`. |
| `recall.initiated` | documented as RETIRED | **PASS** | Retirement holds — zero live producer anywhere (see critical pair #1). |

**Score: 11 PASS (9 LIVE-and-wired + 1 correctly-PLANNED + 1 correctly-RETIRED), 12 FAIL, 25 checked.**

---

## What "generic feed" means, and why it doesn't rescue a FAIL

Two of the four repos — **Ops** (`app/(tabs)/index.tsx:173`, via
`useFamilyActivity()`/`app/activity.tsx`) and **Shield**
(`app/family-connections.tsx:108`) — have a screen that fetches
`family_activity_events` **without any kind filter** and renders every row
generically (Shield keys a display label off `kind` with a raw-string
fallback for anything unrecognised; Ops keys off `owner_app` instead). This
means a kind like `incident.logged` or `waste.logged` is not *hidden* from
users — it shows up as a line item in these two screens.

This report does not count that as a passing cross-app "reaction," because:

1. It proves nothing about whether any **specific behaviour** the taxonomy
   promises (a gate, a task, a compounding check, a netted-off breach) exists
   for that kind.
2. It's resilient by design to exactly this situation — the taxonomy file's
   own doc-comment states the normaliser "tolerates unknown / legacy
   free-text kinds," i.e. the generic feed was built to keep working whether
   or not any given kind is even registered. Its presence is not evidence of
   integration; it's evidence the fallback path works.
3. Only 2 of 4 repos have this screen at all — OneCount and Trace have no
   generic activity feed of any kind.

Where a kind's only "consumer" evidence is this generic render, this report
marks it FAIL and says so explicitly in the note, rather than silently
passing it.

---

## How the script was hardened (false-positive traps found and closed)

Early script drafts scored 21-23 of 25 kinds as FAIL — almost entirely wrong.
Every one of the following was found, diagnosed against a manually-verified
ground truth, and fixed before this report's numbers were trusted:

1. **Builder-function indirection.** Several producers build the event object
   in a separate pure function (`correctiveActionFamilyEvent()`,
   `buildExcursionActivityInput()`, `buildProofProvidedEvent()`, etc.) and
   hand the *result* to `publishFamilyActivity(...)`. A naive scan that only
   looks for `publishFamilyActivity({ kind: "..." })` inline misses every one
   of these — which was most of Shield's producers.
2. **Cross-file constant imports.** `SUPPLIER_REJECTION_KIND` is defined in
   `lib/domain/supplierRisk.ts` and imported into `supplierRejectionEmit.ts`.
   A per-file constant table can't resolve that without real module
   resolution; the script instead builds one constant table per repo across
   all files (safe here because every kind constant in this codebase is a
   globally unique, single-definition string).
3. **TypeScript return-type object literals confuse brace-matching.** A
   function like
   `buildProofProvidedEvent(...): FamilyActivityInput & { payload: Record<string, unknown> } {`
   has a `{...}` in its return-type annotation, before the real body. A naive
   "find the first `{` after the params" grabbed the type literal instead of
   the function body, truncating the extracted body to a fragment that never
   contained the real `return { kind: ... }` — this silently hid
   `buildProofRequiredEvent` and `buildProofProvidedEvent` even after fix #1
   above. Resolved by disambiguating on TS grammar (an object-type literal is
   only ever preceded by `:`/`&`/`|`; a body-opening brace never is).
4. **Optional chaining breaks substring anchors.** OneCount's
   `invoiceApplyWorkflow.ts` calls `deps.publishFamilyActivity?.({...})` (an
   injected, optional-chained dependency) — a plain
   `source.indexOf("publishFamilyActivity(")` search does not match this at
   all, silently losing the `receiving.applied` producer.
5. **Unrelated `kind` fields on other domain types.** One-count-app's
   `quickStartPlan.session.kind === "continue"` (an unrelated discriminated
   union) and `lib/variance.ts`'s
   `.eq("kind", "receive")` (filtering an unrelated `stock_movements_view`
   row-kind column) both use the exact field name `kind` for something that
   has nothing to do with `family_activity_events`. The consumer extractor
   requires the comparison's right-hand side to be a **named constant**
   resolvable through the const table (never a bare string literal), and
   gates post-fetch filtering on the file also referencing
   `FamilyActivityEvent`/`fetchFamilyActivity`/`publishFamilyActivity` — this
   is the single most important anti-false-positive guard in the script.
6. **Taxonomy status parsing matched prose, not list items.** The RETIRED
   bullet's own explanatory text — "`recall.initiated` ... renamed to
   `recall.raised`" — briefly caused the script to mis-tag the *live*
   `recall.raised` kind as retired, because a loose regex matched the
   backtick-quoted mention anywhere in the bullet's text rather than only in
   its actual list position (immediately after `·`, `:`, or `(`, never after
   a prose word like "to").

None of these were hypothetical — each was caught by comparing the script's
output against manually-verified file:line evidence and treated as a script
bug, not accepted as a real finding, until independently confirmed.

## What static analysis CANNOT prove

This report is based entirely on reading source text. It cannot and does not
claim to prove:

- **Runtime reachability beyond what's checked.** The script does not do full
  call-graph analysis from an app entrypoint. Where reachability mattered
  (`training.lapsed`'s producer, `shield.wastage`'s producer), it was checked
  by hand with `grep` for call sites outside tests — this is noted per-kind
  above, but is not something the automated script itself verifies for every
  kind.
- **That the working tree matches any deployed build.** All four apps are
  Expo/React Native apps with their own release cadence; this report reflects
  local repo state as of 2026-07-07, not what is running on any device or in
  any store build.
- **That RLS/policy grants actually let the consuming session read the row.**
  `family_activity_events` has `can_access_org(org_id)`-gated
  select/insert policies (`one-count-app/supabase/baseline/prod_schema.sql`);
  a producer and consumer can both be code-correct and still never connect
  in practice if org/session resolution fails silently — and it can, by
  design: every `publishFamilyActivity` wrapper in all four repos swallows
  its own errors (a deliberate resilience choice, not a bug, but one that
  means a broken insert produces no error anywhere for anyone to notice).
- **That any of this event traffic has ever actually flowed in production**,
  or will again. No logs, no Supabase query, no runtime trace was consulted
  for this report — it is 100% static source analysis, as scoped.

## `kind` column hardening recommendation

`family_activity_events.kind` has **no CHECK constraint or enum** at the
database level in any repo — confirmed in
`one-count-app/supabase/migrations/20260615205101_family_activity_events.sql:1-13`
(only `owner_app` line 5 and `severity` line 7 are constrained) and in the
production schema baseline
(`one-count-app/supabase/baseline/prod_schema.sql:1640-1653`). The only
enforcement is a TypeScript union type (`FamilyActivityKind` in this package)
plus a per-repo Jest drift-guard test
(`tests/familyActivityKindDrift.test.ts`, present in all four app repos) that
checks a repo's own producer literals against this package's exported list.
Both are compile-time/test-time checks with zero runtime teeth — a
mis-typed kind string inserted via direct SQL, a Supabase Studio edit, or any
future producer not covered by a matching drift test would insert silently
and invisibly, with no consumer ever seeing it and no error raised anywhere.
**Recommendation**: add a CHECK constraint on `kind` (a generated column or
trigger-time lookup against a small allow-list table would let it evolve
without a migration per taxonomy change) so a producer/consumer string
mismatch fails loudly at write time instead of silently at read time — this
is the same gap the taxonomy's own resilience contract explicitly chose to
tolerate ("the normaliser tolerates unknown / legacy free-text kinds"), which
is reasonable for consumers but leaves producers with no safety net at all.

---

## Script run log (reference)

```
$ node scripts/verify-event-taxonomy.mjs
========================================================================================================
EVENT TAXONOMY VERIFICATION — @onecount/contracts vs live producer/consumer source
========================================================================================================
OK    OneCount         /Users/cameronharris/Project/One-Count/one-count-app
OK    Ops (Playbook)   /Users/cameronharris/Project/OneCount-Playbook
OK    Shield           /Users/cameronharris/Project/OneCount-Shield
OK    Trace            /Users/cameronharris/Project/OneCount-Trace

Generic (unfiltered) feed screens found in: ops:app/(tabs)/index.tsx, shield:app/family-connections.tsx

KIND                              STATUS      VERDICT NOTE
----------------------------------------------------------------------------------------------------
incident.logged                   documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
check.failed                      documented  PASS    producer x1, consumer x1
check.resolved                    documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
corrective_action_draft_suggested documented  FAIL    No producer, no kind-specific consumer
goods_received                    documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
count.session_requested           documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
waste.logged                      documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
stocktake.finalized               documented  PASS    producer x1, consumer x1
receiving.applied                 documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
receiving.captured                documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
handover.recorded                 documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
shield.excursion                  documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
shield.supplier_rejection         documented  PASS    producer x1, consumer x2
variance.flagged                  planned     PASS    No producer yet (expected); consumer pre-wired
catalog.allergen_changed          documented  PASS    producer x1, consumer x1
recall.raised                     documented  PASS    producer x1, consumer x1
recall.resolved                   documented  PASS    producer x1, consumer x1
shield.wastage                    documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
ops.proof_required                documented  PASS    producer x1, consumer x2
shield.proof_provided             documented  PASS    producer x1, consumer x1
training.lapsed                   documented  FAIL    Producer found; NO kind-specific consumer (generic feed only)
ai.action.drafted                 documented  PASS    producer x1, consumer x1
ai.action.applied                 documented  PASS    producer x1, consumer x1
ai.action.dismissed               documented  PASS    producer x1, consumer x1
recall.initiated                  retired     PASS    No live producer found (retirement holds)

Checked 25 taxonomy kinds. 12 FAIL.

Event taxonomy verification FAILED: 12 mismatch(es) found.
```

Run with `node scripts/verify-event-taxonomy.mjs` from this repo's root.
Override any repo path via `ONECOUNT_APP_PATH` / `ONECOUNT_OPS_PATH` /
`ONECOUNT_SHIELD_PATH` / `ONECOUNT_TRACE_PATH` env vars; a repo not checked
out is soft-skipped (`MISS`, printed, not a hard failure) rather than
crashing the run.

---

## Addendum (same day): taxonomy re-graded to match these findings

Following this report, `src/familyActivityKinds.ts` was re-graded to verified
reality: a new **SIGNAL ONLY** status (producer live, no kind-specific
consumer — generic-feed display only) now covers the 10 kinds this report
failed for consumer overclaims; `training.lapsed` and
`corrective_action_draft_suggested` were demoted to **PLANNED** with their
defects documented inline; `check.resolved` is SIGNAL ONLY with its
netting-only role stated. `scripts/verify-event-taxonomy.mjs` understands the
new status and now exits **0** (24 PASS, 1 INFO — the INFO flags
`training.lapsed`'s dead-code producer for promotion or deletion). The script
is suitable as a CI gate from this commit forward: any future divergence
between taxonomy claims and code reality fails the build.
