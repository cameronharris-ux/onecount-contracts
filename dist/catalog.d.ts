/** Build the canonical catalog ref: catalogRef("abc") -> "onecount:catalog:abc". */
export declare function catalogRef(id: string): string;
/** Parse a catalog ref, returning the bare id, or null if it isn't one. */
export declare function parseCatalogRef(value: string): string | null;
/** Catalog-item lifecycle. Unknown/legacy null statuses normalize to "active". */
export type CatalogItemStatus = "active" | "discontinued" | "archived";
/** A raw `cloud_catalog_items` row, as read from the database (price INCLUDED). */
export interface CatalogItemRow {
    id: string;
    org_id: string;
    name?: string | null;
    brand?: string | null;
    category?: string | null;
    unit_of_measure?: string | null;
    pack_size?: string | null;
    supplier?: string | null;
    status?: string | null;
    allergen_flags?: unknown;
    unit_price_ex_gst?: number | null;
    [key: string]: unknown;
}
/**
 * Price-free catalog facts safe to resolve in ANY family app. Note the deliberate
 * absence of any price/cost field — see toCatalogItemFacts.
 */
export interface CatalogItemFacts {
    ref: string;
    id: string;
    name: string | null;
    brand: string | null;
    category: string | null;
    unitOfMeasure: string | null;
    packSize: string | null;
    supplier: string | null;
    status: CatalogItemStatus;
    allergenFlags: string[];
}
/**
 * Project a raw catalog row to its price-free facts. This is the boundary guard:
 * `unit_price_ex_gst` (and any other field) is intentionally NOT copied — only the
 * named, price-free fields survive — so a resolved catalog item can be handed to
 * Shield/Trace/Playbook without leaking cost. Returns null for a missing row.
 */
export declare function toCatalogItemFacts(row: CatalogItemRow | null | undefined): CatalogItemFacts | null;
