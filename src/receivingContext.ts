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

/** The receiving-context wire schema version. Producer stamps it; consumers gate on it. */
export const RECEIVING_CONTEXT_SCHEMA = "onecount.receiving-context/v1";

/** Keys that must NEVER appear in a receiving-context payload (price/cost leakage guard). */
export const RECEIVING_CONTEXT_FORBIDDEN_KEYS: readonly string[] = [
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

export interface ReceivingContextLineItem {
  name: string;
  storageClass: string;
  quantityLabel?: string;
}

export interface ReceivingContext {
  id: string;
  schemaVersion?: string;
  orgId: string;
  venueId?: string | null;
  supplierName: string;
  invoiceRef?: string | null;
  receivedAt: string;
  lineItems: ReceivingContextLineItem[];
  sourceRef: string;
}

/** A namespaced source ref looks like `app:entity:<id>` (e.g. onecount:invoice:123). */
export function isValidSourceRef(ref: string): boolean {
  return /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*:.+$/.test(ref);
}
