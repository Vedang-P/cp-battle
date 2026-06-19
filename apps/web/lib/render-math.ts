/**
 * Render LaTeX math expressions in markdown to HTML using KaTeX.
 *
 * Handles:
 * - Display math: $$$...$$$
 * - Inline math: $...$
 * - Bare LaTeX commands outside delimiters (fallback to Unicode)
 */

import katex from 'katex';

// Fallback Unicode replacements for bare LaTeX commands outside $ delimiters
const BARE_LATEX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\\leq?\b/g, '≤'],
  [/\\geq?\b/g, '≥'],
  [/\\neq?\b/g, '≠'],
  [/\\times/g, '×'],
  [/\\div/g, '÷'],
  [/\\pm/g, '±'],
  [/\\infty/g, '∞'],
  [/\\dots/g, '...'],
  [/\\cdots/g, '···'],
  [/\\cdot/g, '·'],
  [/\\rightarrow/g, '→'],
  [/\\leftarrow/g, '←'],
  [/\\Rightarrow/g, '⇒'],
  [/\\Leftarrow/g, '⇐'],
];

/**
 * Try to render a LaTeX string with KaTeX. Returns HTML string.
 * Falls back to escaped code on error.
 */
function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      trust: true,
      strict: false,
    });
  } catch {
    return `<code class="katex-fallback">${tex.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`;
  }
}

/**
 * Render LaTeX math in markdown to HTML.
 * Exported as `renderMath` for backward compatibility.
 */
export function renderMath(md: string): string {
  let result = md;

  // 1. Display math: $$$...$$$ → KaTeX block
  result = result.replace(/\$\$\$(.+?)\$\$\$/gs, (_, tex) => {
    return renderKatex(tex.trim(), true);
  });

  // 2. Inline math: $...$ → KaTeX inline
  //    Must not match $$ (display) or $ in URLs/paths
  result = result.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_, tex) => {
    return renderKatex(tex.trim(), false);
  });

  // 3. Bare LaTeX commands outside delimiters (constraint lines, etc.)
  //    Only convert simple commands, leave complex ones alone
  for (const [pattern, replacement] of BARE_LATEX_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  // 4. Convert \( \) and \[ \] delimiters to KaTeX
  result = result.replace(/\\\((.+?)\\\)/g, (_, tex) => {
    return renderKatex(tex.trim(), false);
  });
  result = result.replace(/\\\[(.+?)\\\]/gs, (_, tex) => {
    return renderKatex(tex.trim(), true);
  });

  return result;
}
