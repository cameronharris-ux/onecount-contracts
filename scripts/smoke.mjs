import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const contracts = require("../dist/index.js");

assert.deepEqual(contracts.PRODUCT_IDENTITY.pulse, {
  slug: "pulse",
  name: "OneCount Pulse",
  accent: "#A78BFA",
});
assert.equal(contracts.productIdentityForOwnerApp("pulse")?.slug, "pulse");
assert.equal(contracts.productIdentityForOwnerApp("playbook")?.slug, "ops");
assert.equal(contracts.ref("pulse", "venue", "venue-1"), "pulse:venue:venue-1");
assert.deepEqual(
  contracts.familyLinkEventRow("org-1", "pulse", "onecount://tasks", "opened_app"),
  {
    org_id: "org-1",
    source_app: "pulse",
    target: "onecount://tasks",
    outcome: "opened_app",
  },
);
assert.equal(
  contracts.webFallbackForTarget("onecountpulse://home"),
  "https://onecount.ai",
);
