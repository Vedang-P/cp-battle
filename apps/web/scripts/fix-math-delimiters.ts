/**
 * Post-import script to add LaTeX math delimiters to problems with bare text.
 *
 * The Codeforces dataset has two formats:
 * - Format A: $$$...$$$ delimiters (77 problems) — already works
 * - Format B: Bare text (123 problems) — needs delimiters added
 *
 * This script finds bare math text and wraps it in $ delimiters for KaTeX.
 *
 * Usage: npx tsx apps/web/scripts/fix-math-delimiters.ts
 */

import { db } from '@zapdos/db';

function log(msg: string) {
  console.log(`[fix-math] ${msg}`);
}

/**
 * Add $ delimiters around common math patterns in bare text.
 * Only processes text that doesn't already have $$$ delimiters.
 */
function addMathDelimiters(text: string): string {
  let result = text;

  // Skip if this section already has $$$ delimiters (Codeforces format)
  // We process line by line to be surgical
  const lines = result.split('\n');
  const processedLines: string[] = [];

  for (const line of lines) {
    // Skip lines that already have $$$ delimiters
    if (line.includes('$$$')) {
      processedLines.push(line);
      continue;
    }

    let processed = line;

    // Pattern 1: (1 ≤ X ≤ 105) → ($1 \leq X \leq 10^5$)
    // Handles constraints in parentheses like (1 ≤ n ≤ 105) or (1 ≤ ai ≤ 109)
    processed = processed.replace(
      /\((\d+)\s*≤\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*≤\s*(\d+)\)/g,
      (_, low, variable, high) => {
        const highExp = convertToExponent(high);
        const lowNum = convertToExponent(low);
        const texVar = convertVariable(variable);
        return `($${lowNum} \\leq ${texVar} \\leq ${highExp}$)`;
      }
    );

    // Pattern 2: 1 ≤ X ≤ 105 (without parentheses) — but only in constraint-like contexts
    // Match: digit ≤ var ≤ number, but not inside words
    processed = processed.replace(
      /(\d+)\s*≤\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*≤\s*(\d+)/g,
      (_, low, variable, high) => {
        // Only wrap if this looks like a standalone constraint (not inside a word)
        const highExp = convertToExponent(high);
        const lowNum = convertToExponent(low);
        const texVar = convertVariable(variable);
        return `$${lowNum} \\leq ${texVar} \\leq ${highExp}$`;
      }
    );

    // Pattern 3: contains ≤ or ≥ but not already wrapped in $
    // e.g., "1 ≤ n" or "ai ≥ 1"
    if (processed.includes('≤') || processed.includes('≥')) {
      // Don't double-wrap
      if (!processed.includes('$')) {
        // Convert ≤ and ≥ to LaTeX
        processed = processed.replace(/≤/g, '\\leq');
        processed = processed.replace(/≥/g, '\\geq');
        // Wrap entire constraint expressions in $ delimiters
        // Look for patterns like: number \leq variable or variable \leq number
        processed = processed.replace(
          /(\d+\s*\\leq\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\\leq\s*\d+)/g,
          (match) => `$${match}$`
        );
        // Single constraints: variable \leq number
        processed = processed.replace(
          /(?<!\$)([a-zA-Z_][a-zA-Z0-9_]*\s*\\leq\s*\d+)(?!\$)/g,
          (match) => `$${match}$`
        );
        // Single constraints: number \leq variable
        processed = processed.replace(
          /(?<!\$)(\d+\s*\\leq\s*[a-zA-Z_][a-zA-Z0-9_]*)(?!\$)/g,
          (match) => `$${match}$`
        );
      }
    }

    // Pattern 4: "integer n" or "single integer n" → "integer $n$"
    // But only when n is a simple variable name (1-2 chars, lowercase)
    processed = processed.replace(
      /\b(integer|number|contains?)\s+([a-z])\b/gi,
      (_, word, variable) => {
        // Don't wrap if it's a common English word
        if (['a', 'i', 'o'].includes(variable)) return `${word} ${variable}`;
        return `${word} $${variable}$`;
      }
    );

    // Pattern 5: "n integers" or "n space-separated integers"
    processed = processed.replace(
      /\b([a-z])\s+(integers?|numbers?|strings?|characters?|space-separated)/gi,
      (match, variable, word) => {
        if (['a', 'i', 'o'].includes(variable)) return match;
        return `$${variable}$ ${word}`;
      }
    );

    // Pattern 6: "a1, a2, ..., an" → "$a_1, a_2, \\ldots, a_n$"
    processed = processed.replace(
      /\b([a-z])(\d+)(?:,\s*([a-z])(\d+))*\s*,\s*\.\.\.,\s*([a-z])([a-z])\b/g,
      (match) => {
        // This is an array pattern — wrap in math delimiters
        // Convert to LaTeX: a1, a2, ..., an → a_1, a_2, \ldots, a_n
        const converted = match
          .replace(/([a-z])(\d+)/g, '$1_{$2}')
          .replace(/, \.\.\., /g, ', \\ldots, ')
          .replace(/\.\.\./g, '\\ldots');
        return `$${converted}$`;
      }
    );

    // Pattern 7: "105" in constraint context → "10^5"
    // Only when followed by ) or , or . or end of line, and preceded by ≤
    processed = processed.replace(
      /(\d+)≤\s*(\d{2,3})(?=[),.\s]|$)/g,
      (_, low, high) => {
        const highExp = convertToExponent(high);
        return `${low}≤${highExp}`;
      }
    );

    // Pattern 8: "1 ≤ n ≤ 105" where 105 means 10^5
    // Convert numbers like 105, 109, 106, 103 to 10^5, 10^9, 10^6, 10^3
    processed = processed.replace(
      /≤\s*(10[0-9])\b/g,
      (_, num) => {
        return `≤ ${convertToExponent(num)}`;
      }
    );

    processedLines.push(processed);
  }

  return processedLines.join('\n');
}

/**
 * Convert a number that's likely an exponent to LaTeX notation.
 * e.g., "105" → "10^5", "109" → "10^9", "1000" stays "1000"
 */
function convertToExponent(num: string): string {
  const n = parseInt(num, 10);
  // Check if it's a power of 10: 10, 100, 1000, 10000, etc.
  if (n >= 10 && n <= 10_000_000) {
    const log10 = Math.log10(n);
    if (Number.isInteger(log10)) {
      return `10^{${log10}}`;
    }
  }
  // Check if it's like 105 (= 10^5), 109 (= 10^9), 103 (= 10^3), 106 (= 10^6)
  if (num.length === 3 && num.startsWith('10')) {
    const exp = parseInt(num[2]!, 10);
    if (exp >= 0 && exp <= 9) {
      return `10^{${exp}}`;
    }
  }
  return num;
}

/**
 * Convert a variable name to LaTeX notation.
 * e.g., "ai" → "a_i", "xi" → "x_i", "n" → "n"
 */
function convertVariable(variable: string): string {
  // Single letter variables stay as-is
  if (variable.length === 1) return variable;
  // Two-letter variables like "ai", "xi", "yi" → subscript notation
  if (variable.length === 2 && /^[a-z][a-z]$/.test(variable)) {
    // Could be "ai" → "a_i" or "xi" → "x_i"
    // But also could be two separate variables. Check context.
    // For now, assume subscript for common patterns
    if ('ai'.includes(variable[0]!) || 'xi'.includes(variable[0]!) || 'yi'.includes(variable[0]!)) {
      return `${variable[0]}_{${variable[1]}}`;
    }
  }
  return variable;
}

async function main() {
  log('=== Math Delimiter Fix Script ===');
  log('Finding problems with bare math text...');

  const problems = await db.problem.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      descriptionMd: true,
    },
  });

  log(`Found ${problems.length} problems total`);

  let updated = 0;
  let skipped = 0;

  for (const problem of problems) {
    // Skip if already has $$$ delimiters throughout
    const hasDelimiters = (problem.descriptionMd.match(/\$\$\$/g) ?? []).length > 10;
    if (hasDelimiters) {
      skipped++;
      continue;
    }

    const fixed = addMathDelimiters(problem.descriptionMd);

    if (fixed !== problem.descriptionMd) {
      await db.problem.update({
        where: { id: problem.id },
        data: { descriptionMd: fixed },
      });
      updated++;
      log(`  Updated: ${problem.slug}`);
    }
  }

  log(`\nDone! Updated ${updated} problems, skipped ${skipped} (already had delimiters)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
