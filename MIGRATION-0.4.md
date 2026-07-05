# Migrating to @onecount/contracts v0.4.0

v0.4 promotes two family-shared vocabularies out of app-local files, so
producers/consumers stop drifting (ecosystem roadmap W0-3/W0-12, design-system
doc §4):

- **`familyActivityKinds`** — the `family_activity_events.kind` taxonomy.
  Previously a Shield-local file (`lib/onecount/familyActivityKinds.ts`)
  explicitly marked as a promotion seam. Now canonical here, and extended with
  `count.session_requested` (new OneCount producer, shipped 2026-07 in
  `one-count-app/lib/countSessionRequest.ts`).
- **`productIdentity`** — the family product-identity map (display name +
  ≤12%-fill/dots-never-chrome identity accent per app). Previously two
  byte-for-byte-equivalent local copies of `PRODUCT_COLOURS` inside Shield's
  and Trace's `lib/onecount/familyProvenance.ts`, each marked "promote once a
  second sibling needs this exact map." Now canonical here as
  `PRODUCT_IDENTITY` / `productIdentityForOwnerApp` / `accentForOwnerApp` /
  `labelForOwnerApp`.

Also folded in this release:

- **`deepLinkRegistry`** hygiene (W0-12) — documented the one-canonical-scheme-
  per-app list (`onecountapp`, `onecount`, `onecountshield`, `onecounttrace`)
  and added Trace's QR/deep-link grammar (`TRACE_QR_SCHEME`, `parseTraceQr`,
  `TraceQrTarget`) so siblings can recognise a scanned Trace label without
  depending on Trace's app code. **`onecountplaybook` was NOT deleted** — a
  repo grep across all four apps showed it is still actively built and queried
  as an outbound CTA target in Playbook's, Shield's, and Trace's
  `lib/onecount/ecosystemLinks.ts` (and declared in their
  `LSApplicationQueriesSchemes`). It is now documented as legacy-redirect-only
  in the registry header; removing it is a separate follow-up once those three
  `ecosystemLinks.ts` copies stop emitting it.

No breaking changes to existing v0.3 exports — this is additive.

## Per-app changes on re-pin

### One-Count (`one-count-app`)
- Currently has **no local copy** of either vocabulary — this is a pure
  addition. Nothing to delete, but new code (e.g. anywhere OneCount renders a
  cross-app activity row or a sibling-product dot) should import
  `familyActivityKinds` / `productIdentity` from the package rather than
  inventing local strings/colours.
- `count.session_requested`, built in `lib/countSessionRequest.ts`, currently
  stamps the `kind` string as a local literal — no functional change required,
  but it's worth switching that literal to
  `FamilyActivityKind` from the package for type safety on next touch.
- package.json pin:
  ```
  "@onecount/contracts": "github:cameronharris-ux/onecount-contracts#v0.4.0",
  ```

### Ops (`OneCount-Playbook`)
- `constants/theme.ts` has a local `PRODUCT_COLOURS: Record<string, string>`
  map (onecount/ops/shield/trace hex values) marked with a `ponytail:` comment
  to promote into `@onecount/contracts` v0.4. Replace its dot/identity-colour
  use sites with `productIdentityForOwnerApp` / `accentForOwnerApp` from the
  package; theme.ts can keep its own UI accent tokens (button fills etc.) — only
  the *identity-dot* map is superseded.
- `lib/onecount/ecosystemLinks.ts` still targets `onecountplaybook://` in
  places — no forced change in this pin (the registry still resolves it), but
  new CTAs should target `onecount://ops` directly per the registry's header
  note.
- package.json pin:
  ```
  "@onecount/contracts": "github:cameronharris-ux/onecount-contracts#v0.4.0",
  ```

### Shield (`OneCount-Shield`)
- `lib/onecount/familyActivityKinds.ts` — replace the whole file with a
  one-line re-export shim (or delete it and update the ~4 import sites to
  import from `@onecount/contracts` directly):
  ```ts
  export * from "@onecount/contracts";
  ```
  Verify the taxonomy is still a superset of what Shield actually emits
  (`incident.logged`, `check.failed`, `check.resolved`,
  `corrective_action_draft_suggested`, `shield.wastage`,
  `shield.proof_provided`, `training.lapsed`) — it is, all are ported verbatim.
- `lib/onecount/familyProvenance.ts` — its local `PRODUCT_COLOURS` const and
  `FamilyOwnerApp` type are superseded by `PRODUCT_IDENTITY` /
  `OwnerApp`/`LegacyOwnerApp` in the package. `dotColourForOwnerApp` and
  `ownerAppLabel` stay in Shield (they're Shield-specific — the "never self-dot"
  rule needs to know Shield is "self"), but should delegate to
  `accentForOwnerApp` / `labelForOwnerApp` from the package instead of a local
  copy of the colour table.
- package.json pin:
  ```
  "@onecount/contracts": "github:cameronharris-ux/onecount-contracts#v0.4.0",
  ```

### Trace (`OneCount-Trace`)
- `lib/onecount/familyProvenance.ts` — same change as Shield's: delegate to
  `productIdentity` from the package instead of Trace's local `PRODUCT_COLOURS`
  copy; keep the Trace-specific "never self-dot" wrapper.
- `lib/domain/qr.ts` — this is the **source of truth** the package's
  `parseTraceQr`/`TRACE_QR_SCHEME` were ported from. Trace itself doesn't need
  to switch to the package copy (its local file is more complete — it also has
  `buildBatchQr`/`buildRecallQr`/`buildProductQr` builders the package
  intentionally omits, since building Trace-specific QR payloads is Trace's job,
  not a shared contract). No action required beyond the version bump, but keep
  the two in sync if the payload grammar ever changes — the package copy is a
  read-only "can a sibling parse this" contract, not the writer.
- package.json pin:
  ```
  "@onecount/contracts": "github:cameronharris-ux/onecount-contracts#v0.4.0",
  ```

## Verification per app, after re-pinning
1. `npm install` (or equivalent) to pull the new tag.
2. `tsc`/typecheck clean.
3. Full test suite green (each app has its own contract-parity tests —
   e.g. Shield's `tests/familyProvenance.test.ts`,
   `tests/familyActivityFeed.test.ts` — that should still pass unchanged if the
   ported values are byte-identical, which they are).
4. Grep the app for any remaining local `PRODUCT_COLOURS` /
   `FAMILY_ACTIVITY_KINDS` copies once migrated off them, and delete.
