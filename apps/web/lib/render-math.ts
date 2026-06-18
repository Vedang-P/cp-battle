/**
 * Convert LaTeX-style math in markdown to readable Unicode text.
 *
 * CSES problems use $...$ for inline math with commands like \le, \ge, \times.
 * Instead of adding heavy KaTeX, we convert to readable Unicode.
 */

const LATEX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\$\\le\$/g, '≤'],
  [/\$\\ge\$/g, '≥'],
  [/\$\\ne\$/g, '≠'],
  [/\$\\leq\$/g, '≤'],
  [/\$\\geq\$/g, '≥'],
  [/\$\\neq\$/g, '≠'],
  [/\$\\times\$/g, '×'],
  [/\$\\div\$/g, '÷'],
  [/\$\\pm\$/g, '±'],
  [/\$\\infty\$/g, '∞'],
  [/\$\\dots\$/g, '...'],
  [/\$\\cdots\$/g, '···'],
  [/\$\\rightarrow\$/g, '→'],
  [/\$\\leftarrow\$/g, '←'],
  [/\$\\Rightarrow\$/g, '⇒'],
  [/\$\\Leftarrow\$/g, '⇐'],
  [/\$\\le 10\^\{(\d+)\}\$/g, '≤ 10^$1'],
  [/\$\\ge 10\^\{(\d+)\}\$/g, '≥ 10^$1'],
];

/**
 * Process inline math: $expr$ → readable text.
 * Handles $n$, $10^6$, $1 \le n \le 10^6$, etc.
 */
export function renderMath(md: string): string {
  let result = md;

  // Apply specific known replacements first
  for (const [pattern, replacement] of LATEX_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  // Generic: strip $ delimiters and convert remaining LaTeX commands
  result = result.replace(/\$([^$]+)\$/g, (_, content) => {
    return content
      .replace(/\\le/g, '≤')
      .replace(/\\ge/g, '≥')
      .replace(/\\ne/g, '≠')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥')
      .replace(/\\neq/g, '≠')
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      .replace(/\\pm/g, '±')
      .replace(/\\infty/g, '∞')
      .replace(/\\dots/g, '...')
      .replace(/\\cdots/g, '···')
      .replace(/\\rightarrow/g, '→')
      .replace(/\\leftarrow/g, '←')
      .replace(/\\Rightarrow/g, '⇒')
      .replace(/\\Leftarrow/g, '⇐')
      .replace(/\\le /g, '≤ ')
      .replace(/\\ge /g, '≥ ')
      .replace(/\\ne /g, '≠ ')
      .replace(/\\cdot/g, '·')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
      .replace(/10\^\{(\d+)\}/g, '10^$1')
      .replace(/2\^\{(\d+)\}/g, '2^$1')
      .replace(/\\(|\\)/g, '')
      .replace(/\\,/g, ' ')
      .replace(/\\;/g, ' ');
  });

  return result;
}
