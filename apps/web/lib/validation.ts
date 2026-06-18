/**
 * Validates that a string is a safe ID (CUID or UUID).
 * CUIDs: 25 chars, lowercase alphanumeric (e.g. cmqjjcddf0004pvw3wcno2hn9)
 * UUIDs: 8-4-4-4-12 hex with dashes
 */

const CUID_REGEX = /^[a-z0-9]{25}$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidId(value: string): boolean {
  return CUID_REGEX.test(value) || UUID_REGEX.test(value);
}
