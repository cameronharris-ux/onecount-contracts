# @onecount/contracts

Pure, framework-free **cross-app contracts** for the OneCount family — the single
source of truth for the small set of values/types every app must agree on. No
React Native / Next / RevenueCat dependencies, so it's safe to consume from every
Expo app and the Next.js hub.

The complete family membership is OneCount, Ops, Shield, Trace, and Pulse.
`playbook` remains a legacy Ops compatibility alias, not a sixth product.

## Exports
- **entitlement** — `PRO_ENTITLEMENT_ID`, `SUITE_ENTITLEMENT_ID`, `isProEntitlement` (rule: `suite ⊇ pro`)
- **deepLinkRegistry** — `WEB_HUB_BASE`, `WEB_HUB_FALLBACKS`, `webFallbackForTarget` (deep-link → web-hub fallback, including Pulse's canonical `onecountpulse` scheme); `TRACE_QR_SCHEME`, `parseTraceQr` (Trace's `onecounttrace://b|r|p/...` QR grammar, for siblings that need to recognise a Trace label)
- **receivingContext** — `RECEIVING_CONTEXT_SCHEMA` (`onecount.receiving-context/v1`), forbidden-keys guard, `ReceivingContext` types, `isValidSourceRef`
- **ids** — `ref()` / `parseRef()` for namespaced `app:entity:<id>` references, including Pulse; the `org_id`/`orgId` convention
- **catalog** — canonical catalog ref + price-free projection
- **familyLinkEvents** — shared launcher-funnel contract (`family_link_events` row), with Pulse as a source app
- **familyActivityKinds** — `FAMILY_ACTIVITY_KINDS` taxonomy for the shared `family_activity_events.kind` column, `FamilyActivityOwnerApp`, `FamilyActivitySeverity`, `isKnownFamilyActivityKind`, `normalizeFamilyActivityKind`. `FamilyActivityOwnerApp` is the four-owner set authorized by the current taxonomy, not the complete family membership type; Pulse is not yet an owner and does not publish shared family-activity rows.
- **productIdentity** — `PRODUCT_IDENTITY` map (name + identity accent hex for all five family products), `productIdentityForOwnerApp`, `accentForOwnerApp`, `labelForOwnerApp` — identity dots/icon-fills only, ≤12% of surface, never chrome

## Changelog
- **0.6.0** — Registered OneCount Pulse as the fifth family product in the general identity and routing contracts: added its exact product identity, namespaced-reference membership, launcher-event source membership, and canonical `onecountpulse` scheme with the existing web-hub fallback. The shared family-activity taxonomy and its four-owner union remain unchanged; Pulse does not yet publish shared family-activity rows.
- **0.5.0** — Ground-truth ("taxonomy v1.0 seed") sweep of `familyActivityKinds` across all four app repos' producers + inbound consumers (hospitality-os-2026-07 quick-win #4/#12): added every live-but-missing kind (`waste.logged`, `stocktake.finalized`, `receiving.applied` from OneCount; `receiving.captured`, `handover.recorded` from Ops; `variance.flagged` from Ops as planned; `recall.raised`, `recall.resolved`, `catalog.allergen_changed`, `ops.proof_required`, `shield.proof_provided` per the Shield/Ops/Trace recall+proof contract); corrected `shield.excursion` and `shield.supplier_rejection` from PLANNED to LIVE (both have verified producers); added `recall.initiated` marked DEPRECATED (Trace still emits it, but Shield's consumer switches on `recall.raised`/`recall.resolved` — replacement, not a working alias); every entry now carries a one-line producer/consumer comment.
- **0.4.0** — Promoted `familyActivityKinds` (from Shield's `lib/onecount/familyActivityKinds.ts`) and `productIdentity` (from the Shield/Trace `lib/onecount/familyProvenance.ts` `PRODUCT_COLOURS` copies) into the shared package; added `count.session_requested` to the activity taxonomy (new OneCount producer); added Trace's QR/deep-link grammar (`TRACE_QR_SCHEME`, `parseTraceQr`) to `deepLinkRegistry`; documented `onecountplaybook` as a legacy-redirect-only scheme (still emitted by 3 apps — not removed) and clarified the one-canonical-scheme-per-app list. See `MIGRATION-0.4.md`.
- **0.3.0** — Shared launcher-funnel contract (`family_link_events` row).
- **0.2.0** — Canonical catalog ref + price-free projection.
- **0.1.0** — Initial publish-ready scaffold: `entitlement`, `deepLinkRegistry`, `receivingContext`, `ids`.

## Status
This is the **end-state** of the shared-contracts plan (see each app repo's
`docs/SHARED_CONTRACTS_PACKAGE_PLAN.md`). Until every app depends on this package,
the **interim parity gate** (`scripts/check-shared-contracts.mjs` in the Playbook
repo) keeps the per-app copies in sync — edit the contract there and re-sync, or
adopt this package and delete the copies.

## Publishing (git dependency, no registry)
There is no npm registry publish step. Versioning is a `v*` git tag on this repo
plus the committed `dist/` (CJS build checked into the repo). To cut a release:

```
npm install
npm run build   # regenerates dist/
git add dist && git commit -m "vX.Y.Z"
git tag vX.Y.Z && git push && git push --tags
```

## Consuming (per app)
1. Add `@onecount/contracts` to `dependencies` as a git dependency pointing at
   this repo and tag, e.g. `"@onecount/contracts": "github:cameronharris-ux/onecount-contracts#v0.6.0"`
   (or a local `file:`/path dependency for same-machine development).
2. Expo apps: add `@onecount/contracts` to `transpilePackages` (metro/app config) if consuming source; not needed for the compiled `dist`. Next.js hub: add to `transpilePackages` in `next.config`.
3. Replace the local `entitlementContract.ts` / `deepLinkRegistry.ts` copies with imports; delete the copies; drop them from the parity gate.
