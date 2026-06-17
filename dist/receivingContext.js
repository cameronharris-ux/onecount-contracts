"use strict";
/**
 * Canonical OneCount→Shield/Trace receiving-context contract. OneCount (the
 * producer) emits a PRICE-FREE row on invoice apply; Shield/Trace (consumers)
 * read it. The wire schema version below is the value producer + consumers MUST
 * agree on — it is what each app's version gate compares against.
 *
 * NOTE: today each app keeps its own consumer guards (Shield uses a forbidden-
 * keys array, Trace a ReadonlySet). This module provides the canonical shapes
 * apps converge to as they adopt the package; until then, the value-parity gate
 * in Playbook (scripts/check-shared-contracts.mjs) locks the schema version.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECEIVING_CONTEXT_FORBIDDEN_KEYS = exports.RECEIVING_CONTEXT_SCHEMA = void 0;
exports.isValidSourceRef = isValidSourceRef;
/** The receiving-context wire schema version. Producer stamps it; consumers gate on it. */
exports.RECEIVING_CONTEXT_SCHEMA = "onecount.receiving-context/v1";
/** Keys that must NEVER appear in a receiving-context payload (price/cost leakage guard). */
exports.RECEIVING_CONTEXT_FORBIDDEN_KEYS = [
    "price",
    "unitPrice",
    "unit_price",
    "cost",
    "unitCost",
    "unit_cost",
    "lineTotal",
    "line_total",
    "total",
    "amount",
    "subtotal",
    "tax",
];
/** A namespaced source ref looks like `app:entity:<id>` (e.g. onecount:invoice:123). */
function isValidSourceRef(ref) {
    return /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*:.+$/.test(ref);
}
