# @onecount/contracts

Pure, framework-free **cross-app contracts** for the OneCount family — the single
source of truth for the small set of values/types every app must agree on. No
React Native / Next / RevenueCat dependencies, so it's safe to consume from every
Expo app and the Next.js hub.

## Exports
- **entitlement** — `PRO_ENTITLEMENT_ID`, `SUITE_ENTITLEMENT_ID`, `isProEntitlement` (rule: `suite ⊇ pro`)
- **deepLinkRegistry** — `WEB_HUB_BASE`, `WEB_HUB_FALLBACKS`, `webFallbackForTarget` (deep-link → web-hub fallback)
- **receivingContext** — `RECEIVING_CONTEXT_SCHEMA` (`onecount.receiving-context/v1`), forbidden-keys guard, `ReceivingContext` types, `isValidSourceRef`
- **ids** — `ref()` / `parseRef()` for namespaced `app:entity:<id>` references; the `org_id`/`orgId` convention

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
