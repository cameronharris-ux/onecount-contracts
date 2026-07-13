#!/usr/bin/env node
/**
 * scripts/verify-event-taxonomy.mjs — independent cross-app verification of the
 * `family_activity_events.kind` taxonomy this package publishes
 * (src/familyActivityKinds.ts).
 *
 * WHY THIS EXISTS: an internal pass (hospitality-os-2026-07 quick-win #4/#12,
 * 2026-07-06) self-reported that 3 previously-dead cross-app event pairs had
 * been reconnected, and wrote producer/consumer file-path annotations directly
 * into FAMILY_ACTIVITY_KINDS as if independently verified. That claim was never
 * checked by anyone outside the pipeline that made it. This script is the
 * outside check: it re-derives, from the actual source of the four sibling app
 * repos (NOT from the taxonomy file's own comments), which kinds are really
 * emitted and really consumed, and reports where the two sides disagree.
 *
 * METHOD (static analysis only — see the printed LIMITATIONS section for what
 * this can never prove):
 *
 *   1. CANONICAL — every kind string in this package's own
 *      FAMILY_ACTIVITY_KINDS array (src/familyActivityKinds.ts), parsed as text
 *      (not imported from dist — importing the compiled package would trust
 *      the very build this script exists to check independently).
 *
 *   2. PRODUCERS — per sibling repo, every kind string actually passed to that
 *      repo's `publishFamilyActivity(...)` wrapper (the one function every
 *      repo uses to insert a row into `family_activity_events`), resolved two
 *      ways:
 *        a. INLINE   — `publishFamilyActivity({ kind: "x", ... })`, optionally
 *           `"x" satisfies FamilyActivityKind`, or `kind: SOME_KIND` where
 *           `SOME_KIND` is a `const SOME_KIND = "x"` in the same file.
 *        b. BUILDER   — `publishFamilyActivity(someBuilder(args))` where
 *           `someBuilder` is a function DEFINED IN THE SAME FILE whose body
 *           contains a `return { kind: "x", ... }` (Shield's
 *           correctiveActions.ts / triggers.ts use this shape — the literal
 *           event object is built in a separate pure function for testability,
 *           then handed to publishFamilyActivity by the caller).
 *      A DB-trigger producer (OneCount's `goods_received`) is extracted
 *      separately, anchored to `insert into public.family_activity_events`
 *      inside a migration's plpgsql function body, reading the `kind` value
 *      positionally from the column list the INSERT declares.
 *
 *   3. CONSUMERS — per sibling repo, three real shapes were found in this
 *      codebase and are all treated as evidence of consumption:
 *        a. QUERY-FILTERED — `fetchFamilyActivity({ kinds: [SOME_KIND] })`
 *           (Shield's style: server-side filter per reactor).
 *        b. POST-FETCH FILTER — `SOME_KIND_SET.has(e.kind)` /
 *           `e.kind === SOME_KIND` / `e.kind !== SOME_KIND` in a file that
 *           also imports `FamilyActivityEvent` or references
 *           `fetchFamilyActivity`/`publishFamilyActivity` (Ops's style: fetch
 *           the whole feed unfiltered, then have several small pure functions
 *           each filter client-side). The import/reference gate is the
 *           anti-false-positive guard — see (c) below for why it's load-
 *           bearing, not decorative.
 *        c. GENERIC FEED SCREEN — a repo-level fact, not a per-kind one: does
 *           this repo have ANY screen that renders `family_activity_events`
 *           rows without restricting to specific kinds (detected via
 *           `useFamilyActivity`/`fetchFamilyActivity` called with no `kinds`
 *           filter from an `app/**` screen)? If so, every kind is at least
 *           weakly "consumed" there (rendered, not hidden) — reported
 *           separately and NEVER upgrades a kind to PASS on its own, because
 *           a generic renderer displaying an unrecognised kind string proves
 *           nothing about whether that kind's specific cross-app *reaction*
 *           (reactor logic, gating, netting) actually exists.
 *      A bare `.eq("kind", ...)` / `.in("kind", ...)` NOT gated by (b)'s
 *      import/reference check is deliberately excluded — this is the single
 *      biggest false-positive trap in this codebase: one-count-app's
 *      lib/variance.ts filters an unrelated `stock_movements_view` row kind
 *      ("receive") with the exact same `.eq("kind", ...)` shape and must
 *      never be counted as a family_activity_events consumer.
 *
 *   4. DB CONSTRAINTS — any CHECK constraint / enum whitelist on
 *      `family_activity_events.kind` in each repo's supabase/migrations (there
 *      is none today; only `owner_app` and `severity` are constrained — this
 *      script reports that fact rather than assuming a whitelist exists).
 *
 * VERDICT RULE: a `documented` (LIVE) kind PASSes only when a strong producer
 * (2) AND a strong consumer (3a or 3b) are both found somewhere in the four
 * repos. A `planned` kind is expected to have no producer. A `retired` kind
 * having a live producer is a FAIL (the retirement claim is false). Generic
 * feed rendering (3c) is reported but never sufficient for a PASS on its own —
 * see the printed table's "generic feed only" annotation for kinds that would
 * otherwise show FAIL with zero reactor-level consumer.
 *
 * Dependency-free: Node stdlib only (fs, path, url). Exit code is non-zero on any
 * mismatch.
 */
import fs from "node:fs";
import path from "node:path";
import { findPublishCallAnchors, repoRootFromModuleUrl } from "./taxonomy-scanner.mjs";

const REPO_ROOT = repoRootFromModuleUrl(import.meta.url);

const REPOS = {
  onecount: {
    label: "OneCount",
    root: process.env.ONECOUNT_APP_PATH || "/Users/cameronharris/Project/One-Count/one-count-app",
    scanDirs: ["app", "lib", "components", "hooks"],
  },
  ops: {
    label: "Ops (Playbook)",
    root: process.env.ONECOUNT_OPS_PATH || "/Users/cameronharris/Project/OneCount-Playbook",
    scanDirs: ["app", "lib", "components", "hooks"],
  },
  shield: {
    label: "Shield",
    root: process.env.ONECOUNT_SHIELD_PATH || "/Users/cameronharris/Project/OneCount-Shield",
    scanDirs: ["app", "lib", "components", "hooks"],
  },
  trace: {
    label: "Trace",
    root: process.env.ONECOUNT_TRACE_PATH || "/Users/cameronharris/Project/OneCount-Trace",
    scanDirs: ["app", "lib", "components", "hooks"],
  },
};

const EXCLUDED_DIR_SEGMENTS = new Set(["node_modules", ".expo", ".git", "dist"]);
const SOURCE_FILE_RE = /\.(ts|tsx)$/;
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx)$/;
const TEST_DIR_RE = /(^|\/)(__tests__|tests)(\/|$)/;

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

function listSourceFiles(dir, { includeTests = false } = {}) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIR_SEGMENTS.has(entry.name)) continue;
    if (!includeTests && (entry.name === "__tests__" || entry.name === "tests")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full, { includeTests }));
    } else if (SOURCE_FILE_RE.test(entry.name)) {
      if (!includeTests && TEST_FILE_RE.test(entry.name)) continue;
      out.push(full);
    }
  }
  return out;
}

function listMigrationFiles(repoRoot) {
  const dir = path.join(repoRoot, "supabase", "migrations");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .map((e) => path.join(dir, e.name));
}

/** 1-based line number of a character offset in `source`. */
function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

/** Find the matching `}` for the `{` at `braceStart`, brace-depth counted. */
function matchBrace(source, braceStart) {
  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end++) {
    if (source[end] === "{") depth++;
    else if (source[end] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return end;
}

// ---------------------------------------------------------------------------
// 1. Canonical taxonomy — parsed as text from src/familyActivityKinds.ts.
// ---------------------------------------------------------------------------

function loadCanonicalTaxonomy() {
  const file = path.join(REPO_ROOT, "src", "familyActivityKinds.ts");
  const source = fs.readFileSync(file, "utf8");
  const arrayMatch = source.match(/export const FAMILY_ACTIVITY_KINDS = \[([\s\S]*?)\] as const;/);
  if (!arrayMatch) {
    throw new Error(`Could not locate FAMILY_ACTIVITY_KINDS array literal in ${file}`);
  }
  const body = arrayMatch[1];
  const kinds = [];
  const literalRe = /["']([a-zA-Z0-9_.]+)["']/g;
  let m;
  while ((m = literalRe.exec(body))) {
    kinds.push(m[1]);
  }
  // Status is documented only in the doc-comment's bullet list above the
  // array (the "Canonical kinds, by owning app and status" comment — there
  // are several doc comments in this file, so select that one specifically),
  // in the shape ` *  - LABEL...: kindA · kindB (prose) · kindC`. Split it
  // strictly on lines that OPEN a new bullet (`* - `, a literal dash right
  // after the leading `*`).
  //
  // Within a bullet's accumulated text, a kind counts as belonging to that
  // bullet's OWN list only if it appears in "list position" — preceded by
  // list punctuation (start-of-text, `·`, `(`, or `:`) rather than by prose
  // words. This is what keeps the RETIRED bullet's incidental aside ("Trace
  // dab187b renamed to `recall.raised`") from mis-tagging `recall.raised` as
  // retired: "to `recall.raised`" has "to" (a prose word) immediately before
  // the token, which is never how this file's real list items are written.
  const status = new Map(kinds.map((k) => [k, "documented"]));
  const bulletListComment = [...source.matchAll(/\/\*\*[\s\S]*?\*\//g)].find((m) =>
    m[0].includes("Canonical kinds, by owning app and status")
  );
  if (bulletListComment) {
    const lines = bulletListComment[0].split("\n");
    let currentLabel = null;
    let currentBody = [];
    const flush = () => {
      if (!currentLabel) return;
      const text = currentBody.join(" ");
      const label = /RETIRED/.test(currentLabel) ? "retired" : /PLANNED/.test(currentLabel) ? "planned" : /SIGNAL ONLY/.test(currentLabel) ? "signal-only" : null;
      if (label) {
        for (const k of kinds) {
          // List-start position ONLY: start-of-text, right after `·`, or
          // right after `:` / `(` — never after a bare space, which would
          // also match mid-sentence prose like "renamed to `recall.raised`"
          // (the space before the backtick there is NOT a list separator).
          const escaped = k.replace(/\./g, "\\.");
          const re = new RegExp("(^\\s*|·\\s*|[:(]\\s*)`?" + escaped + "`?(?=[\\s·),.]|$)");
          if (re.test(text)) status.set(k, label);
        }
      }
    };
    for (const line of lines) {
      const bulletOpen = /^\s*\*\s*-\s*([A-Z][A-Za-z ]*)/.exec(line);
      if (bulletOpen) {
        flush();
        currentLabel = bulletOpen[1];
        currentBody = [line.replace(/^\s*\*\s*-\s*[A-Z][A-Za-z ]*:?/, "")];
      } else if (currentLabel) {
        currentBody.push(line.replace(/^\s*\*\s*/, ""));
      }
    }
    flush();
  }
  return { file, kinds, status };
}

// ---------------------------------------------------------------------------
// Shared: `const NAME = "literal"` symbol table, REPO-WIDE (not per-file).
//
// Kind constants are frequently defined in one file (e.g.
// lib/domain/supplierRisk.ts's SUPPLIER_REJECTION_KIND) and imported for use
// in another (lib/onecount/supplierRejectionEmit.ts). A per-file table cannot
// resolve that import without a full module-resolution pass, which this
// script deliberately does not implement (dependency-free, no TS compiler).
// Building the table repo-wide instead is a safe shortcut here specifically
// because every kind constant observed across all four repos is a globally
// unique, single-definition string (`FOO_KIND = "domain.thing.verb"`) — a
// name collision would require two different constants named identically
// with different values, which the taxonomy's own naming convention (one
// `_KIND` const per literal, exported) makes vanishingly unlikely and which
// would itself be a real drift bug worth surfacing, not hiding.
// ---------------------------------------------------------------------------

function buildRepoConstTable(files) {
  const table = new Map();
  const re = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*[^=]+)?=\s*["']([^"']+)["']\s*(as const)?/g;
  // Object-of-string-literals form: `const NAME = { key: "x", key2: "y" } as
  // const satisfies ...` (one-count-app's ACTION_AUDIT_KINDS shape). Indexed
  // into the SAME flat table under the dotted key `"NAME.key"` so
  // `kind: ACTION_AUDIT_KINDS.drafted` resolves the same way a bare `_KIND`
  // const would.
  const objRe = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*[^=]+)?=\s*\{([^{}]*)\}\s*as const/g;
  const objEntryRe = /([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*["']([^"']+)["']/g;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(source))) {
      if (!table.has(m[1])) table.set(m[1], m[2]);
    }
    objRe.lastIndex = 0;
    while ((m = objRe.exec(source))) {
      const objName = m[1];
      const body = m[2];
      objEntryRe.lastIndex = 0;
      let em;
      while ((em = objEntryRe.exec(body))) {
        const key = `${objName}.${em[1]}`;
        if (!table.has(key)) table.set(key, em[2]);
      }
    }
  }
  return table;
}

function resolveValue(token, constTable) {
  const literal = token.match(/^["'`]([^"'`]+)["'`]$/);
  if (literal) return literal[1];
  const bare = token.trim().replace(/\s*satisfies.*$/, "");
  if (constTable.has(bare)) return constTable.get(bare);
  return null;
}

/**
 * Repo-wide map of listVarName -> array of literal kind values, for
 * `const LIST = Object.values(SOME_OBJ)` (one-count-app's
 * `ACTION_AUDIT_KIND_LIST`) and `const LIST = [A, B]` (array of
 * const-references or literals) bindings. Used by the direct-Supabase-query
 * consumer shape `.in("kind", LIST)`.
 */
function buildRepoListTable(files, constTable) {
  const table = new Map();
  const objectValuesRe = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*[^=]+)?=\s*Object\.values\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/g;
  const arrayLiteralRe = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*[^=]+)?=\s*\[([^\]]*)\]/g;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    let m;
    objectValuesRe.lastIndex = 0;
    while ((m = objectValuesRe.exec(source))) {
      const [, listName, objName] = m;
      const values = [...constTable.entries()]
        .filter(([k]) => k.startsWith(`${objName}.`))
        .map(([, v]) => v);
      if (values.length && !table.has(listName)) table.set(listName, values);
    }
    arrayLiteralRe.lastIndex = 0;
    while ((m = arrayLiteralRe.exec(source))) {
      const [, listName, body] = m;
      const items = body.split(",").map((s) => s.trim()).filter(Boolean);
      const resolved = items.map((item) => resolveValue(item, constTable)).filter(Boolean);
      if (resolved.length && resolved.length === items.length && !table.has(listName)) {
        table.set(listName, resolved);
      }
    }
  }
  return table;
}

/**
 * 3d. DIRECT QUERY — `.from(family_activity_events table).select(...).in("kind", LIST)`
 * (one-count-app's action-log screen: `listActionAuditLog` reads the shared
 * table directly rather than through the `fetchFamilyActivity` wrapper).
 * Anchored on `.from(FAMILY_ACTIVITY_EVENTS_TABLE)` / `.from("family_activity_events")`
 * appearing within a short preceding window of the `.in("kind", ...)` call —
 * the same anti-false-positive discipline as the other consumer shapes.
 */
function extractDirectQueryConsumers(source, constTable, listTable) {
  const found = [];
  const re = /\.in\(\s*["']kind["']\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/g;
  let m;
  while ((m = re.exec(source))) {
    const windowStart = Math.max(0, m.index - 300);
    const window = source.slice(windowStart, m.index);
    const isFamilyActivityQuery =
      /\.from\(\s*FAMILY_ACTIVITY_EVENTS_TABLE\s*\)/.test(window) ||
      /\.from\(\s*["']family_activity_events["']\s*\)/.test(window);
    if (!isFamilyActivityQuery) continue;
    const listName = m[1];
    if (listTable.has(listName)) {
      for (const value of listTable.get(listName)) found.push({ kind: value, index: m.index });
    } else if (constTable.has(listName)) {
      found.push({ kind: constTable.get(listName), index: m.index });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// 2. Producer extraction.
// ---------------------------------------------------------------------------

/**
 * Map of builderFnName -> resolved kind, for
 * `function NAME(...) {...return {kind: "x" | SOME_CONST, ...}...}` and the
 * arrow-function equivalent, searched repo-wide (a builder can be imported
 * across files the same way a bare kind constant can).
 */
/**
 * Given the index of the parameter list's opening `(`, skip past the matched
 * `)` and then past any TypeScript return-type annotation (`: Foo<Bar> | null`)
 * to find the function BODY's opening `{` — bracket-depth aware across
 * `()[]<>{}` together, so a return type that itself contains a `{...}`
 * (an inline object-type annotation, e.g.
 * `(FamilyActivityInput & { payload: Record<string, unknown> }) | null`) is
 * skipped as a whole rather than mistaken for the body opener. A naive
 * `[^{]*\{` regex (the first version of this script) stops at the type
 * annotation's own `{`, truncating the "body" to just that type fragment and
 * silently losing the real `return { kind: ... }` inside — this is what
 * originally hid Ops's `buildProofRequiredEvent`.
 */
/** Index just past the character at `braceStart` that closes its own `{`/`}` pair. */
function skipBalancedBraces(source, braceStart) {
  let depth = 0;
  let i = braceStart;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return source.length;
}

/**
 * Given the index of the parameter list's opening `(`, find the closing `)`
 * (depth-aware across `()[]<>` — the params themselves may contain generics
 * like `Pick<CheckResponse, "id" | "status">`), then scan forward through any
 * TypeScript return-type annotation to the function BODY's opening `{`.
 *
 * The tricky part: a return-type annotation can itself contain a balanced
 * `{...}` object-type literal (e.g.
 * `): FamilyActivityInput & { payload: Record<string, unknown> } {`) — a
 * naive scan stops at THAT `{`, truncating the extracted "body" to just the
 * type fragment and silently losing the real `return { kind: ... }` inside.
 * This is what originally hid Shield's `buildProofProvidedEvent`. Handled by
 * skipping any balanced `{...}` run encountered before a `{` that is instead
 * followed (after skipping ITS OWN close) by only whitespace-then-more-`{`,
 * i.e. we keep consuming whole balanced brace groups as "type literals" until
 * the one immediately followed by a statement (not end-of-annotation) — in
 * practice this codebase's shapes are simple enough that "skip every
 * balanced-brace group whose contents look like a type (contain `:` before
 * any `return`/statement keyword), keep going until `{` is followed by
 * something else" resolves correctly; see the concrete fallback below.
 */
function findFunctionBodyBrace(source, parenOpenIdx) {
  let depth = 0;
  let i = parenOpenIdx;
  let closeParenIdx = -1;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(" || ch === "[" || ch === "<") depth++;
    else if (ch === ")" || ch === "]" || ch === ">") depth--;
    if (depth === 0 && ch === ")") {
      closeParenIdx = i;
      break;
    }
  }
  if (closeParenIdx === -1) return -1;

  // Walk forward from just past the param list. Every `{` encountered at the
  // top level (d2 === 0) is EITHER the function body opener OR an object-type
  // literal inside the return-type annotation (e.g.
  // `): FamilyActivityInput & { payload: Record<string, unknown> } {`).
  // Disambiguate using TS grammar: a return-type object-type literal is only
  // ever preceded (ignoring whitespace) by `:` or `&` or `|` — the tokens that
  // introduce/continue a type expression. A body-opening `{` is preceded by
  // the tail of a bare type reference (an identifier/`>`/`]`/`)`), never by
  // one of those three punctuation marks. So: if the nearest non-whitespace
  // character before this `{` is `:`, `&`, or `|`, it's a type literal — skip
  // it as a balanced group and keep scanning; otherwise it's the real body.
  let j = closeParenIdx + 1;
  let d2 = 0;
  for (; j < source.length; j++) {
    const c2 = source[j];
    if (c2 === "(" || c2 === "[" || c2 === "<") d2++;
    else if (c2 === ")" || c2 === "]" || c2 === ">") d2--;
    else if (c2 === ";" && d2 === 0) return -1; // type-only declaration, no body
    else if (c2 === "{" && d2 === 0) {
      let p = j - 1;
      while (p >= 0 && /\s/.test(source[p])) p--;
      const precedingChar = source[p];
      if (precedingChar === ":" || precedingChar === "&" || precedingChar === "|") {
        // Type-literal brace — skip the whole balanced group and continue.
        j = skipBalancedBraces(source, j) - 1; // -1 to offset the loop's j++
        continue;
      }
      return j; // Real function body opener.
    }
  }
  return -1;
}

function buildRepoBuilderKindTable(files, constTable) {
  const table = new Map();
  const kindFieldRe = /\breturn\s*\{[^}]*?\bkind\s*:\s*([A-Za-z0-9_$."'`]+)/;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");

    const fnHeaderRe = /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:<[^(]*>)?\s*\(/g;
    let m;
    while ((m = fnHeaderRe.exec(source))) {
      const parenOpenIdx = m.index + m[0].length - 1;
      const braceStart = findFunctionBodyBrace(source, parenOpenIdx);
      if (braceStart === -1) continue;
      const end = matchBrace(source, braceStart);
      const body = source.slice(braceStart, end + 1);
      const kindMatch = kindFieldRe.exec(body);
      if (kindMatch) {
        const value = resolveValue(kindMatch[1], constTable);
        if (value && !table.has(m[1])) table.set(m[1], value);
      }
    }

    const arrowHeaderRe = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*[^=]+)?=\s*(?:async\s*)?\(/g;
    while ((m = arrowHeaderRe.exec(source))) {
      const parenOpenIdx = m.index + m[0].length - 1;
      // Confirm this paren is actually followed (after its close + optional
      // return type) by `=>` and THEN `{` — otherwise it's an ordinary call,
      // not an arrow-function definition.
      const braceStart = findFunctionBodyBrace(source, parenOpenIdx);
      if (braceStart === -1) continue;
      const between = source.slice(parenOpenIdx, braceStart);
      if (!between.includes("=>")) continue; // not actually an arrow function
      const end = matchBrace(source, braceStart);
      const body = source.slice(braceStart, end + 1);
      const kindMatch = kindFieldRe.exec(body);
      if (kindMatch) {
        const value = resolveValue(kindMatch[1], constTable);
        if (value && !table.has(m[1])) table.set(m[1], value);
      }
    }
  }
  return table;
}

const FETCH_CALL_RE = /(?:[A-Za-z_$][A-Za-z0-9_$]*\.)?fetchFamilyActivity\s*(?:\?\.)?\s*\(/g;

function extractProducers(source, constTable, builderTable) {
  const found = [];

  // Track `const NAME = builder(...)` / `const NAME: T = builder(...)`
  // variable bindings in THIS file, so `publishFamilyActivity(variable)` can
  // resolve back to the builder's kind (Shield's proofObligationInbound.ts
  // shape: `const input = buildProofProvidedEvent(...); ...publishFamilyActivity(input)`).
  const localVarKind = new Map();
  const varBindRe = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*[^=]+)?=\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  let vm;
  while ((vm = varBindRe.exec(source))) {
    if (builderTable.has(vm[2])) localVarKind.set(vm[1], builderTable.get(vm[2]));
  }

  for (const anchorMatch of findPublishCallAnchors(source)) {
    const anchorIdx = anchorMatch.index;
    const afterAnchor = anchorIdx + anchorMatch[0].length;
    let i = afterAnchor;
    while (i < source.length && /\s/.test(source[i])) i++;

    if (source[i] === "{") {
      // INLINE shape: publishFamilyActivity({ kind: "x" | SOME_KIND, ... })
      const end = matchBrace(source, i);
      const block = source.slice(i, end + 1);
      const kindMatch = /\bkind\s*:\s*([A-Za-z0-9_$."'`]+)/.exec(block);
      if (kindMatch) {
        const value = resolveValue(kindMatch[1], constTable);
        if (value) found.push({ kind: value, index: i, shape: "inline" });
      }
    } else {
      const idMatch = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*([(),;\s]|$)/.exec(source.slice(i));
      const ident = idMatch?.[1];
      const isCall = idMatch?.[2] === "(";
      if (ident && isCall && builderTable.has(ident)) {
        // BUILDER-CALL shape: publishFamilyActivity(someBuilder(...))
        found.push({ kind: builderTable.get(ident), index: anchorIdx, shape: `builder-call:${ident}` });
      } else if (ident && !isCall && localVarKind.has(ident)) {
        // VARIABLE shape: const input = someBuilder(...); publishFamilyActivity(input)
        found.push({ kind: localVarKind.get(ident), index: anchorIdx, shape: `builder-var:${ident}` });
      }
    }
  }
  return found;
}

/** DB-trigger producer: `insert into public.family_activity_events (...) values (...)`. */
function extractMigrationProducers(source) {
  const found = [];
  const insertRe = /insert\s+into\s+public\.family_activity_events\s*\(([^)]*)\)\s*values\s*\(/gi;
  let m;
  while ((m = insertRe.exec(source))) {
    const columns = m[1].split(",").map((c) => c.trim());
    const kindColumnIndex = columns.indexOf("kind");
    if (kindColumnIndex === -1) continue;
    const valuesStart = m.index + m[0].length;
    // Find the matching close paren for this values(...) tuple by paren-depth.
    let depth = 1;
    let end = valuesStart;
    for (; end < source.length && depth > 0; end++) {
      if (source[end] === "(") depth++;
      else if (source[end] === ")") depth--;
    }
    const tuple = source.slice(valuesStart, end - 1);
    // Split top-level commas (depth-aware, since values can contain nested calls).
    const parts = [];
    let cur = "";
    let pd = 0;
    for (const ch of tuple) {
      if (ch === "(") pd++;
      if (ch === ")") pd--;
      if (ch === "," && pd === 0) {
        parts.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    parts.push(cur);
    const kindArg = (parts[kindColumnIndex] ?? "").trim();
    const literal = kindArg.match(/^["']([a-zA-Z0-9_.]+)["']$/);
    if (literal) found.push({ kind: literal[1], index: m.index });
  }
  return found;
}

// ---------------------------------------------------------------------------
// 3. Consumer extraction.
// ---------------------------------------------------------------------------

/** 3a. QUERY-FILTERED — `fetchFamilyActivity({ ...kinds: [A, B]... })`. */
function extractQueryFilteredConsumers(source, constTable) {
  const found = [];
  FETCH_CALL_RE.lastIndex = 0;
  let anchorMatch;
  while ((anchorMatch = FETCH_CALL_RE.exec(source))) {
    const anchorIdx = anchorMatch.index;
    const afterAnchor = anchorIdx + anchorMatch[0].length;
    const braceStart = source.indexOf("{", afterAnchor);
    if (braceStart === -1 || braceStart - afterAnchor > 20) continue; // no object arg, or too far to be this call's arg
    const end = matchBrace(source, braceStart);
    const block = source.slice(braceStart, end + 1);
    const arrMatch = /\bkinds\s*:\s*\[([^\]]*)\]/.exec(block);
    if (arrMatch) {
      const items = arrMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      for (const item of items) {
        const value = resolveValue(item, constTable);
        if (value) found.push({ kind: value, index: braceStart });
      }
    }
  }
  return found;
}

/**
 * 3b. POST-FETCH FILTER — `X.has(e.kind)` / `e.kind === X_KIND` / `e.kind !== X_KIND`
 * anywhere in a file that also imports FamilyActivityEvent or calls
 * fetchFamilyActivity/publishFamilyActivity (the anti-false-positive gate —
 * without it, an unrelated `.kind` on a different domain type would match:
 * this repo family has at least two unrelated discriminated unions that use
 * the same `kind` field name, e.g. one-count-app's
 * `quickStartPlan.session.kind === "continue"`).
 *
 * The `===`/`!==` form additionally REQUIRES the right-hand side to be a
 * named identifier that resolves through the const table (never a bare
 * quoted literal) — every genuine family-activity comparison in this
 * codebase goes through a `_KIND`/`_KINDS` constant, while the false
 * positives found during development (`"continue"`, `typeof r.kind ===
 * "string"`) were always bare string literals. This trades a small amount of
 * recall (an inline `e.kind === "literal.kind"` with no named constant would
 * be missed) for eliminating an entire class of false positive; no such
 * inline-literal comparison was observed anywhere in the four repos.
 */
function extractPostFetchFilterConsumers(source, constTable) {
  const isFamilyActivityFile =
    /FamilyActivityEvent/.test(source) ||
    /\bfetchFamilyActivity\s*(?:\?\.)?\s*\(/.test(source) ||
    /\bpublishFamilyActivity\s*(?:\?\.)?\s*\(/.test(source);
  if (!isFamilyActivityFile) return [];

  const found = [];

  // SOME_SET.has(e.kind) / SOME_SET.has(event.kind)
  const hasRe = /\b([A-Za-z_$][A-Za-z0-9_$]*)\.has\(\s*[A-Za-z_$][A-Za-z0-9_$.]*\.kind\s*\)/g;
  let m;
  while ((m = hasRe.exec(source))) {
    const setName = m[1];
    const setDefRe = new RegExp(`\\bconst\\s+${setName}\\s*(?::[^=]+)?=\\s*new Set\\(\\s*\\[([^\\]]*)\\]`);
    const setDef = setDefRe.exec(source);
    if (setDef) {
      const items = setDef[1].split(",").map((s) => s.trim()).filter(Boolean);
      for (const item of items) {
        const value = resolveValue(item, constTable);
        if (value) found.push({ kind: value, index: m.index });
      }
    } else if (constTable.has(setName)) {
      found.push({ kind: constTable.get(setName), index: m.index });
    }
  }

  // e.kind === SOME_KIND / e.kind !== SOME_KIND — identifier RHS only (see doc above).
  const eqRe = /[A-Za-z_$][A-Za-z0-9_$.]*\.kind\s*(?:===|!==)\s*([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  while ((m = eqRe.exec(source))) {
    if (!constTable.has(m[1])) continue;
    found.push({ kind: constTable.get(m[1]), index: m.index });
  }

  return found;
}

/** 3c. GENERIC FEED SCREEN — repo-level: any app/** screen fetching with no kind filter. */
function detectGenericFeedScreen(repoRoot, scanDirs) {
  for (const dir of scanDirs) {
    if (path.basename(dir) !== "app") continue;
    for (const file of listSourceFiles(path.join(repoRoot, dir))) {
      const source = fs.readFileSync(file, "utf8");
      const usesFeed = /\buseFamilyActivity\s*\(/.test(source) || /\bfetchFamilyActivity\s*(?:\?\.)?\s*\(/.test(source);
      if (!usesFeed) continue;
      // Confirm no `kinds:` filter is present alongside the call in this file
      // (a screen that only ever calls a kind-filtered fetch isn't "generic").
      const hasKindsFilter = /\bkinds\s*:\s*\[/.test(source);
      if (!hasKindsFilter) {
        return { file: path.relative(repoRoot, file) };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-repo scan
// ---------------------------------------------------------------------------

function scanRepo(repo) {
  const producers = [];
  const consumers = [];
  if (!fs.existsSync(repo.root)) return { producers, consumers, present: false, genericFeed: null };

  const allFiles = repo.scanDirs.flatMap((dir) => listSourceFiles(path.join(repo.root, dir)));
  const constTable = buildRepoConstTable(allFiles);
  const builderTable = buildRepoBuilderKindTable(allFiles, constTable);
  const listTable = buildRepoListTable(allFiles, constTable);

  for (const file of allFiles) {
    const source = fs.readFileSync(file, "utf8");
    const relFile = path.relative(repo.root, file);

    for (const p of extractProducers(source, constTable, builderTable)) {
      producers.push({ kind: p.kind, file: relFile, line: lineOf(source, p.index), shape: p.shape });
    }
    for (const c of extractQueryFilteredConsumers(source, constTable)) {
      consumers.push({ kind: c.kind, file: relFile, line: lineOf(source, c.index), shape: "query-filtered" });
    }
    for (const c of extractPostFetchFilterConsumers(source, constTable)) {
      consumers.push({ kind: c.kind, file: relFile, line: lineOf(source, c.index), shape: "post-fetch-filter" });
    }
    for (const c of extractDirectQueryConsumers(source, constTable, listTable)) {
      consumers.push({ kind: c.kind, file: relFile, line: lineOf(source, c.index), shape: "direct-query" });
    }
  }

  for (const file of listMigrationFiles(repo.root)) {
    const source = fs.readFileSync(file, "utf8");
    for (const p of extractMigrationProducers(source)) {
      producers.push({ kind: p.kind, file: path.relative(repo.root, file), line: lineOf(source, p.index), shape: "db-trigger" });
    }
  }

  const genericFeed = detectGenericFeedScreen(repo.root, repo.scanDirs);

  return { producers, consumers, present: true, genericFeed };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function pad(str, len) {
  str = String(str);
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function main() {
  const taxonomy = loadCanonicalTaxonomy();
  const repoResults = {};
  for (const [key, repo] of Object.entries(REPOS)) repoResults[key] = scanRepo(repo);

  const producersByKind = new Map();
  const consumersByKind = new Map();

  for (const [repoKey, result] of Object.entries(repoResults)) {
    for (const p of result.producers) {
      const arr = producersByKind.get(p.kind) ?? [];
      arr.push({ repo: repoKey, ...p });
      producersByKind.set(p.kind, arr);
    }
    for (const c of result.consumers) {
      const arr = consumersByKind.get(c.kind) ?? [];
      arr.push({ repo: repoKey, ...c });
      consumersByKind.set(c.kind, arr);
    }
  }

  const genericFeedRepos = Object.entries(repoResults)
    .filter(([, r]) => r.genericFeed)
    .map(([key, r]) => `${key}:${r.genericFeed.file}`);

  console.log("=".repeat(104));
  console.log("EVENT TAXONOMY VERIFICATION — @onecount/contracts vs live producer/consumer source");
  console.log("=".repeat(104));
  for (const [key, repo] of Object.entries(REPOS)) {
    const present = repoResults[key].present;
    console.log(`${present ? "OK  " : "MISS"}  ${repo.label.padEnd(16)} ${present ? repo.root : `${repo.root} (not checked out)`}`);
  }
  console.log(`\nGeneric (unfiltered) feed screens found in: ${genericFeedRepos.length ? genericFeedRepos.join(", ") : "none"}`);
  console.log("(a generic feed screen renders any kind, known or not — it is evidence a kind is not");
  console.log(" HIDDEN, but not evidence any kind-specific cross-app reaction exists for it.)\n");

  let failures = 0;
  let checkedKinds = 0;
  const rows = [];

  for (const kind of taxonomy.kinds) {
    const status = taxonomy.status.get(kind);
    const producerHits = producersByKind.get(kind) ?? [];
    const consumerHits = consumersByKind.get(kind) ?? [];
    const hasProducer = producerHits.length > 0;
    const hasConsumer = consumerHits.length > 0;
    const genericOnly = !hasConsumer && genericFeedRepos.length > 0;

    let verdict;
    let note;
    checkedKinds++;

    if (status === "retired") {
      if (hasProducer) {
        verdict = "FAIL";
        note = `RETIRED kind still has a live producer: ${producerHits.map((p) => `${p.repo}:${p.file}:${p.line}`).join(", ")}`;
        failures++;
      } else {
        verdict = "PASS";
        note = "No live producer found (retirement holds)";
      }
    } else if (status === "planned") {
      if (hasProducer) {
        verdict = "INFO";
        note = `Marked PLANNED but a producer now exists: ${producerHits.map((p) => `${p.repo}:${p.file}:${p.line}`).join(", ")} — promote in taxonomy`;
      } else {
        verdict = "PASS";
        note = hasConsumer
          ? `No producer yet (expected); consumer pre-wired at ${consumerHits.map((c) => `${c.repo}:${c.file}:${c.line}`).join(", ")}`
          : "No producer, no consumer (expected for PLANNED)";
      }
    } else if (status === "signal-only") {
      if (!hasProducer) {
        verdict = "FAIL";
        note = "Marked SIGNAL ONLY but no live producer found";
        failures++;
      } else if (hasConsumer) {
        verdict = "INFO";
        note = `Marked SIGNAL ONLY but a kind-specific consumer now exists: ${consumerHits.map((c) => `${c.repo}:${c.file}:${c.line}`).join(", ")} — promote to LIVE in taxonomy`;
      } else {
        verdict = "PASS";
        note = "Producer live; no kind-specific consumer (as documented — generic feed display only)";
      }
    } else if (hasProducer && hasConsumer) {
      verdict = "PASS";
      note = `producer x${producerHits.length}, consumer x${consumerHits.length}`;
    } else if (hasProducer && !hasConsumer) {
      verdict = "FAIL";
      note = genericOnly
        ? `Producer found; NO kind-specific consumer (only generic feed render in ${genericFeedRepos.join(", ")})`
        : "Producer found, NO consumer found anywhere (dead pair)";
      failures++;
    } else if (!hasProducer && hasConsumer) {
      verdict = "FAIL";
      note = "Consumer found, NO producer found anywhere (dead pair)";
      failures++;
    } else {
      verdict = "FAIL";
      note = genericOnly ? "No producer, no kind-specific consumer" : "No producer AND no consumer found";
      failures++;
    }

    rows.push({ kind, status, verdict, note });
  }

  console.log(pad("KIND", 34) + pad("STATUS", 12) + pad("VERDICT", 8) + "NOTE");
  console.log("-".repeat(104));
  for (const row of rows) console.log(pad(row.kind, 34) + pad(row.status, 12) + pad(row.verdict, 8) + row.note);

  console.log("\nProducer evidence (file:line):");
  for (const [kind, hits] of producersByKind.entries()) {
    for (const h of hits) console.log(`  ${kind.padEnd(32)} <- ${h.repo}:${h.file}:${h.line} [${h.shape}]`);
  }
  console.log("\nConsumer evidence (file:line):");
  for (const [kind, hits] of consumersByKind.entries()) {
    for (const h of hits) console.log(`  ${kind.padEnd(32)} -> ${h.repo}:${h.file}:${h.line} [${h.shape}]`);
  }

  console.log(`\nChecked ${checkedKinds} taxonomy kinds. ${failures} FAIL.\n`);
  console.log("LIMITATIONS OF STATIC ANALYSIS (this script CANNOT prove):");
  console.log("  - That a producer/consumer call site is REACHABLE at runtime. A function can pass");
  console.log("    every check above and still never be called from any screen or flow (this script");
  console.log("    does not do call-graph reachability from an app entrypoint) — cross-check the");
  console.log("    evidence table against actual call sites by hand for anything load-bearing.");
  console.log("  - That a deployed build matches the working tree scanned here.");
  console.log("  - That RLS/policy grants let the consuming user actually read the row.");
  console.log("  - That the insert succeeds at runtime (auth/session/org resolution can no-op silently —");
  console.log("    every publishFamilyActivity wrapper in this family swallows its own errors by design).");
  console.log("  - Any of this ran successfully in production, or ever will again.");

  if (failures > 0) {
    console.error(`\nEvent taxonomy verification FAILED: ${failures} mismatch(es) found.`);
    process.exit(1);
  }
  console.log("\nEvent taxonomy verification passed (static analysis only — see LIMITATIONS above).");
}

main();
