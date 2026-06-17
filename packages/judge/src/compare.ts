/**
 * Token-based output comparison (the competitive-programming standard).
 *
 * Naive string equality ("3" vs " 3\n") would flag countless correct programs
 * as Wrong Answer. Instead we tokenize both outputs on whitespace and compare
 * token sequences. This is what Codeforces / Kattis / ICPC all do.
 *
 *   "1 2 3"   == "1   2\n3\n"   ✓
 *   "1.0"     != "1"            ✗ (different tokens)
 *   "a b"     != "a  b"         ✓ (whitespace-collapsing, same tokens)
 *
 * Edge cases handled:
 *   - trailing whitespace / newlines ignored
 *   - empty output (program prints nothing) compares equal to empty expected
 *   - numbers kept as strings (so "1.0" != "1"); CP judges don't auto-coerce
 */

/** Split on any run of whitespace, drop empties. */
function tokenize(s: string): string[] {
  return s.split(/\s+/).filter((t) => t.length > 0);
}

/**
 * Returns true iff `actual` matches `expected` under token comparison.
 */
export function isOutputCorrect(actual: string, expected: string): boolean {
  const a = tokenize(actual);
  const e = tokenize(expected);
  if (a.length !== e.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== e[i]) return false;
  }
  return true;
}
