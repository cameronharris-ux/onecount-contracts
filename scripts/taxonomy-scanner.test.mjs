#!/usr/bin/env node

import assert from "node:assert/strict";
import test from "node:test";

import { findPublishCallAnchors, repoRootFromModuleUrl } from "./taxonomy-scanner.mjs";

function matchedTexts(source) {
  return findPublishCallAnchors(source).map((match) => match[0]);
}

test("finds a direct publishFamilyActivity call", () => {
  assert.deepEqual(matchedTexts("publishFamilyActivity({ kind: value });"), ["publishFamilyActivity("]);
});

test("finds a receiver-qualified publishFamilyActivity call", () => {
  assert.deepEqual(matchedTexts("deps.publishFamilyActivity({ kind: value });"), ["deps.publishFamilyActivity("]);
});

test("finds an optional-chained publishFamilyActivity call", () => {
  assert.deepEqual(matchedTexts("deps.publishFamilyActivity?.({ kind: value });"), ["deps.publishFamilyActivity?.("]);
});

test("finds a non-null asserted publishFamilyActivity call", () => {
  assert.deepEqual(matchedTexts("deps.publishFamilyActivity!({ kind: value });"), ["deps.publishFamilyActivity!("]);
});

test("does not match a longer publishFamilyActivity identifier", () => {
  assert.deepEqual(matchedTexts("publishFamilyActivityType({ kind: value });"), []);
});

test("does not match publishFamilyActivity inside a prefixed JavaScript identifier", () => {
  const source = "$publishFamilyActivity({ kind: value });\n_publishFamilyActivity({ kind: value });";

  assert.deepEqual(matchedTexts(source), []);
});

test("decodes percent-encoded spaces when resolving the repository root", () => {
  const moduleUrl = "file:///Users/cameronharris/Project/OneCount%20-%20Pulse/scripts/taxonomy-scanner.mjs";

  assert.equal(repoRootFromModuleUrl(moduleUrl), "/Users/cameronharris/Project/OneCount - Pulse");
});
