/** Merge class names — lightweight cn() without external deps. */
export function cn(...inputs: (string | undefined | null | false | 0)[]) {
  return inputs.filter(Boolean).join(' ');
}
