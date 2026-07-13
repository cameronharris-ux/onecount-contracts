import path from "node:path";
import { fileURLToPath } from "node:url";

export function findPublishCallAnchors(source) {
  const publishCallRe = /\b(?:[A-Za-z_$][A-Za-z0-9_$]*\.)?publishFamilyActivity\s*(?:\?\.|!)?\s*\(/g;
  return [...source.matchAll(publishCallRe)];
}

export function repoRootFromModuleUrl(moduleUrl) {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..");
}
