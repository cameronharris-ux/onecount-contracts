# @onecount/contracts

Pure, framework-free **cross-app contracts** for the OneCount family — the single
source of truth for the small set of values/types every app must agree on. No
React Native / Next / RevenueCat dependencies, so it's safe to consume from every
Expo app and the Next.js hub.

## Exports
- **entitlement** — `PRO_ENTITLEMENT_ID`, `SUITE_ENTITLEMENT_ID`, `isProEntitlement` (rule: `suite ⊇ pro`)
- **deepLinkRegistry** — `WEB_HUB_BASE`, `WEB_HUB_FALLBACKS`, `webFallbackForTarget` (deep-link → web-hub fallback); `TRACE_QR_SCHEME`, `parseTraceQr` (Trace's `onecounttrace://b|r|p/...` QR grammar, for siblings that need to recognise a Trace label)
- **receivingContext** — `RECEIVING_CONTEXT_SCHEMA` (`onecount.receiving-context/v1`), forbidden-keys guard, `ReceivingContext` types, `isValidSourceRef`
- **ids** — `ref()` / `parseRef()` for namespaced `app:entity:<id>` references; the `org_id`/`orgId` convention
- **catalog** — canonical catalog ref + price-free projection
- **familyLinkEvents** — shared launcher-funnel contract (`family_link_events` row)
- **familyActivityKinds** — `FAMILY_ACTIVITY_KINDS` taxonomy for the shared `family_activity_events.kind` column, `FamilyActivityOwnerApp`, `FamilyActivitySeverity`, `isKnownFamilyActivityKind`, `normalizeFamilyActivityKind`
- **productIdentity** — `PRODUCT_IDENTITY` map (name + identity accent hex per app), `productIdentityForOwnerApp`, `accentForOwnerApp`, `labelForOwnerApp` — identity dots/icon-fills only, ≤12% of surface, never chrome

## Changelog
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

## Publishing (GitHub Packages)
Requires an `onecount` GitHub org (the `@onecount` npm scope maps to it). Publish
is automated by `.github/workflows/publish.yml` on a `v*` tag, or manually:

```
npm install
npm run build
npm publish   # needs an .npmrc auth token with write:packages
```

## Consuming (per app)
1. Add `@onecount/contracts` to `dependencies`.
2. Add `@onecount:registry=https://npm.pkg.github.com` to the app's `.npmrc` (+ a read token in CI/EAS).
3. Expo apps: add `@onecount/contracts` to `transpilePackages` (metro/app config) if consuming source; not needed for the compiled `dist`. Next.js hub: add to `transpilePackages` in `next.config`.
4. Replace the local `entitlementContract.ts` / `deepLinkRegistry.ts` copies with imports; delete the copies; drop them from the parity gate.
