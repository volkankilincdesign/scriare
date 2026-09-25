/**
 * Hand back the previous object when nothing about it changed (v0.51.0).
 *
 * React Flow diffs nodes and edges BY REFERENCE. FlowPanel's memos are
 * keyed on `project`, so editing one scene's title produced 300 new node
 * objects and — on a story with choices in it — several hundred new edge
 * objects, and every one of them was reconciled.
 *
 * Measured on 300 scenes with 450 choices, one title edit, median of three
 * paired runs: the Story Graph cost 81.9 ms of the keystroke before this
 * and 58.3 ms after, with the scene-node half worth about another 11.
 *
 * A signature is cheaper than the reconciliation it avoids, and both
 * callers build one from primitives only. What must NOT go through here is
 * anything whose `data` carries a callback: handing back a cached object
 * hands back the closure captured with it, and a stale closure is a bug
 * that looks nothing like a performance change. FlowPanel's group nodes
 * are excluded for exactly that reason.
 *
 * Its own module, and tested directly, because the timing harness cannot
 * guard it: the graph resolves to about ±10 ms over three paired runs,
 * which is the same size as the effect. Identity either is reused or it is
 * not, and that is a question with a definite answer on any machine.
 */
export type SignatureCache<T> = Map<string, { sig: string; value: T }>;

export function newSignatureCache<T>(): SignatureCache<T> {
  return new Map();
}

export function reuseBySignature<T>(
  cache: SignatureCache<T>,
  key: string,
  sig: string,
  build: () => T,
): T {
  const hit = cache.get(key);
  if (hit && hit.sig === sig) return hit.value;
  const value = build();
  cache.set(key, { sig, value });
  return value;
}

/**
 * Drops entries for keys that are no longer present.
 *
 * Without this the cache is a leak with a friendly name: a writer who
 * deletes two hundred scenes over a session leaves two hundred node
 * objects reachable for as long as the project stays open.
 */
export function pruneSignatureCache<T>(cache: SignatureCache<T>, live: Set<string>): void {
  for (const key of cache.keys()) if (!live.has(key)) cache.delete(key);
}
