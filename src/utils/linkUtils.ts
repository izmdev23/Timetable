export interface DynamicDataRow {
  id: string;
  dataType: string;
  value: string;
  displayAs: string;
}

export function getLinks(dynamicData: DynamicDataRow[]): Map<string, string> {
  const links = new Map<string, string>();
  for (const d of dynamicData) {
    if (d.dataType === 'link') {
      links.set(d.value, d.displayAs);
    }
  }
  return links;
}

export function getParentKey(blockKey: string, links: Map<string, string>): string | null {
  return links.get(blockKey) ?? null;
}

export function getChildrenKeys(parentKey: string, links: Map<string, string>): string[] {
  const children: string[] = [];
  for (const [child, parent] of links) {
    if (parent === parentKey) {
      children.push(child);
    }
  }
  return children;
}

export function isParent(blockKey: string, links: Map<string, string>): boolean {
  for (const [, parent] of links) {
    if (parent === blockKey) return true;
  }
  return false;
}

export function isChild(blockKey: string, links: Map<string, string>): boolean {
  return links.has(blockKey);
}

export interface LinkValidation {
  valid: boolean;
  reason?: string;
}

export function canLink(parentKey: string, childKey: string, links: Map<string, string>): LinkValidation {
  if (parentKey === childKey) {
    return { valid: false, reason: 'Cannot link a block to itself.' };
  }
  if (isChild(parentKey, links)) {
    return { valid: false, reason: 'A child block cannot become a parent. Only top-level blocks can be parents.' };
  }
  if (isChild(childKey, links)) {
    return { valid: false, reason: 'This block is already a child of another parent and cannot be linked again.' };
  }
  if (isParent(childKey, links)) {
    return { valid: false, reason: 'A parent block cannot become a child. Unlink its children first.' };
  }
  for (const [child, parent] of links) {
    if (parent === parentKey && child === childKey) {
      return { valid: false, reason: 'These blocks are already linked.' };
    }
  }
  return { valid: true };
}

export function getConnectedKeys(startKey: string, links: Map<string, string>): Set<string> {
  const adjacency = new Map<string, string[]>();
  const allKeys = new Set<string>();

  for (const [child, parent] of links) {
    allKeys.add(child);
    allKeys.add(parent);
    if (!adjacency.has(child)) adjacency.set(child, []);
    if (!adjacency.has(parent)) adjacency.set(parent, []);
    adjacency.get(child)!.push(parent);
    adjacency.get(parent)!.push(child);
  }

  if (!allKeys.has(startKey)) {
    return new Set([startKey]);
  }

  const visited = new Set<string>();
  const queue = [startKey];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (!visited.has(curr)) {
      visited.add(curr);
      const neighbors = adjacency.get(curr) || [];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          queue.push(n);
        }
      }
    }
  }
  return visited;
}
