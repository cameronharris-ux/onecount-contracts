/**
 * Canonical OneCount family id vocabulary.
 *
 * - Wire/row form: `org_id`, `venue_id` (snake). TS form: `orgId`, `venueId` (camel).
 * - Cross-entity references are namespaced strings: `app:entity:<id>`,
 *   e.g. `onecount:catalog:<id>`, `playbook:recipe:<id>`, `trace:batch:<id>`,
 *   `shield:submission:<id>`, `onecount:invoice:<id>`.
 */

export type FamilyApp = "onecount" | "ops" | "shield" | "trace" | "playbook";

/** Build a namespaced cross-entity reference, e.g. ref("onecount","invoice","123"). */
export function ref(app: FamilyApp, entity: string, id: string): string {
  return `${app}:${entity}:${id}`;
}

/** Parse a namespaced reference back into its parts, or null if malformed. */
export function parseRef(value: string): { app: string; entity: string; id: string } | null {
  const m = value.match(/^([a-z][a-z0-9-]*):([a-z][a-z0-9-]*):(.+)$/);
  return m ? { app: m[1], entity: m[2], id: m[3] } : null;
}
