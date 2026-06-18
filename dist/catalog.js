"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRef = catalogRef;
exports.parseCatalogRef = parseCatalogRef;
exports.toCatalogItemFacts = toCatalogItemFacts;
/**
 * Canonical catalog-item reference + price-free projection.
 *
 * The OneCount inventory app owns `cloud_catalog_items` (the product master).
 * Every other app should reference an item by the canonical ref
 * `onecount:catalog:<id>` rather than carrying its own private notion of an
 * item/ingredient/product. This module is the single place that (a) builds and
 * parses that ref and (b) projects a raw catalog row down to the PRICE-FREE
 * facts that are safe to share across the family boundary — `cloud_catalog_items`
 * carries `unit_price_ex_gst`, which Shield/Trace must never receive, so the
 * projection drops it in one audited place.
 */
const ids_1 = require("./ids");
/** Build the canonical catalog ref: catalogRef("abc") -> "onecount:catalog:abc". */
function catalogRef(id) {
    return (0, ids_1.ref)("onecount", "catalog", id);
}
/** Parse a catalog ref, returning the bare id, or null if it isn't one. */
function parseCatalogRef(value) {
    const parsed = (0, ids_1.parseRef)(value);
    if (!parsed || parsed.app !== "onecount" || parsed.entity !== "catalog")
        return null;
    return parsed.id;
}
function normalizeStatus(value) {
    return value === "discontinued" || value === "archived" ? value : "active";
}
function normalizeAllergens(value) {
    if (Array.isArray(value))
        return value.filter((v) => typeof v === "string");
    return [];
}
/**
 * Project a raw catalog row to its price-free facts. This is the boundary guard:
 * `unit_price_ex_gst` (and any other field) is intentionally NOT copied — only the
 * named, price-free fields survive — so a resolved catalog item can be handed to
 * Shield/Trace/Playbook without leaking cost. Returns null for a missing row.
 */
function toCatalogItemFacts(row) {
    if (!row || typeof row.id !== "string")
        return null;
    return {
        ref: catalogRef(row.id),
        id: row.id,
        name: row.name ?? null,
        brand: row.brand ?? null,
        category: row.category ?? null,
        unitOfMeasure: row.unit_of_measure ?? null,
        packSize: row.pack_size ?? null,
        supplier: row.supplier ?? null,
        status: normalizeStatus(row.status),
        allergenFlags: normalizeAllergens(row.allergen_flags),
    };
}
