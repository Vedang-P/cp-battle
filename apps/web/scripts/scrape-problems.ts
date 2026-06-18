/**
 * Problem scraper — imports REAL competitive programming problems from
 * CSES (https://cses.fi/problemset/) and AtCoder (https://atcoder.jp/).
 *
 * Features:
 *   - Live progress output (every problem logged)
 *   - Batched DB saves (every 10 problems) so progress is never lost
 *   - Bias toward EASY/MEDIUM problems (the bulk of the corpus)
 *   - Upsert by slug — re-running updates existing problems
 *
 * Usage:
 *   pnpm scrape-problems              # scrape all sources
 *   pnpm scrape-problems -- --cses    # CSES only
 *   pnpm scrape-problems -- --atcoder # AtCoder only
 */

import { db } from '@cp-battle/db';
import * as cheerio from 'cheerio';
import type { Difficulty } from '@cp-battle/db';

// ─── Types ────────────────────────────────────────────────────────────

interface ScrapedTestCase {
  input: string;
  expectedOutput: string;
  isSample: boolean;
  explanation?: string;
}

interface ScrapedProblem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  descriptionMd: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  points: number;
  starterCode: Record<string, string>;
  testCases: ScrapedTestCase[];
  source: string;
}

// ─── Utilities ────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const POINTS: Record<Difficulty, number> = {
  EASY: 100,
  MEDIUM: 200,
  HARD: 350,
};

const DEFAULT_STARTER_CODE: Record<string, string> = {
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // TODO: implement solution\n    return 0;\n}\n`,
  python: `# TODO: implement solution\n`,
  java: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // TODO: implement solution\n    }\n}\n`,
};

/** Live progress logger — prints with timestamp, flushes immediately. */
function progress(msg: string): void {
  const ts = new Date().toISOString().split('T')[1]!.slice(0, 8);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CPBattleBot/1.0; +https://cp-battle.dev)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (res.status === 429) {
        progress(`  ⚠ Rate limited, waiting 5s...`);
        await sleep(5000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error(`Failed after ${maxRetries} retries: ${url}`);
}

/** Convert a cheerio element's inner HTML to markdown. */
function htmlToMarkdown($: cheerio.CheerioAPI, elem: cheerio.AnyNode): string {
  let md = '';
  $(elem).contents().each((_, node) => {
    const el = $(node);
    if (node.type === 'text') {
      md += el.text();
    } else if (node.tagName === 'p') {
      md += '\n' + htmlToMarkdown($, node) + '\n';
    } else if (node.tagName === 'h1') {
      md += '\n## ' + el.text().trim() + '\n';
    } else if (node.tagName === 'h2') {
      md += '\n### ' + el.text().trim() + '\n';
    } else if (node.tagName === 'h3') {
      md += '\n#### ' + el.text().trim() + '\n';
    } else if (node.tagName === 'ul' || node.tagName === 'ol') {
      el.children('li').each((_, li) => {
        md += `- ${$(li).text().trim()}\n`;
      });
    } else if (node.tagName === 'b' || node.tagName === 'strong') {
      md += `**${el.text()}**`;
    } else if (node.tagName === 'i' || node.tagName === 'em') {
      md += `*${el.text()}*`;
    } else if (node.tagName === 'code') {
      md += `\`${el.text()}\``;
    } else if (node.tagName === 'pre') {
      md += '\n```\n' + el.text() + '\n```\n';
    } else if (node.tagName === 'a') {
      md += `[${el.text()}](${el.attr('href') ?? '#'})`;
    } else if (node.tagName === 'br') {
      md += '\n';
    } else if (node.tagName === 'span') {
      const cls = el.attr('class') ?? '';
      if (cls.includes('math')) {
        md += `$${el.text()}$`;
      } else {
        md += el.text();
      }
    } else {
      md += el.text();
    }
  });
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Batched DB Import ────────────────────────────────────────────────

const BATCH_SIZE = 10;
let batchBuffer: ScrapedProblem[] = [];
let totalImported = 0;
let totalUpdated = 0;
let totalFailed = 0;

async function flushBatch(): Promise<void> {
  if (batchBuffer.length === 0) return;
  const batch = batchBuffer.splice(0);
  for (const prob of batch) {
    try {
      await db.$transaction(async (tx) => {
        const existing = await tx.problem.findUnique({
          where: { slug: prob.slug },
          include: { testCases: { select: { id: true } } },
        });

        if (existing) {
          await tx.testCase.deleteMany({ where: { problemId: existing.id } });
          await tx.problem.update({
            where: { id: existing.id },
            data: {
              title: prob.title,
              difficulty: prob.difficulty,
              descriptionMd: prob.descriptionMd,
              timeLimitMs: prob.timeLimitMs,
              memoryLimitMb: prob.memoryLimitMb,
              points: prob.points,
              starterCode: prob.starterCode,
              isVisible: true,
            },
          });
          for (let i = 0; i < prob.testCases.length; i++) {
            const tc = prob.testCases[i]!;
            await tx.testCase.create({
              data: {
                problemId: existing.id,
                order: i,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isSample: tc.isSample,
                explanation: tc.explanation,
              },
            });
          }
          totalUpdated++;
        } else {
          await tx.problem.create({
            data: {
              slug: prob.slug,
              title: prob.title,
              difficulty: prob.difficulty,
              descriptionMd: prob.descriptionMd,
              timeLimitMs: prob.timeLimitMs,
              memoryLimitMb: prob.memoryLimitMb,
              points: prob.points,
              starterCode: prob.starterCode,
              isVisible: true,
              testCases: {
                create: prob.testCases.map((tc, i) => ({
                  order: i,
                  input: tc.input,
                  expectedOutput: tc.expectedOutput,
                  isSample: tc.isSample,
                  explanation: tc.explanation,
                })),
              },
            },
          });
          totalImported++;
        }
      });
    } catch (err) {
      progress(`  ✗ DB error for ${prob.slug}: ${err instanceof Error ? err.message : err}`);
      totalFailed++;
    }
  }
  progress(`  💾 Saved batch — total: ${totalImported} new, ${totalUpdated} updated, ${totalFailed} failed`);
}

/** Queue a problem for batched import. Flushes automatically every BATCH_SIZE. */
async function queueImport(prob: ScrapedProblem): Promise<void> {
  batchBuffer.push(prob);
  if (batchBuffer.length >= BATCH_SIZE) {
    await flushBatch();
  }
}

// ─── CSES Scraper ─────────────────────────────────────────────────────
// CSES difficulty mapping — biased toward EASY/MEDIUM.
// Categories like "Introductory" and "Sorting" are EASY/MEDIUM.
// We SKIP "Interactive Problems" (no stdin/stdout) and limit HARD.

const CSES_DIFFICULTY: Record<string, Difficulty | 'SKIP'> = {
  'Introductory Problems': 'EASY',
  'Sorting and Searching': 'MEDIUM',
  'Dynamic Programming': 'HARD',
  'Graph Algorithms': 'MEDIUM',
  'Range Queries': 'MEDIUM',
  'Tree Algorithms': 'HARD',
  'Mathematics': 'MEDIUM',
  'String Algorithms': 'HARD',
  'Geometry': 'HARD',
  'Advanced Techniques': 'HARD',
  'Sliding Window Problems': 'MEDIUM',
  'Interactive Problems': 'SKIP', // no stdin/stdout
  'Bitwise Operations': 'MEDIUM',
  'Construction Problems': 'HARD',
  'Advanced Graph Problems': 'HARD',
  'Counting Problems': 'HARD',
  'Additional Problems I': 'MEDIUM',
  'Additional Problems II': 'HARD',
};

async function scrapeCSES(): Promise<void> {
  progress('━━━ CSES: Fetching problem list ━━━');
  const html = await fetchWithRetry('https://cses.fi/problemset/');
  const $ = cheerio.load(html);

  const problems: { id: string; title: string; category: string; difficulty: Difficulty }[] = [];
  let currentCategory = '';

  $('h2, a').each((_, elem) => {
    const el = $(elem);
    if (elem.tagName === 'h2') {
      currentCategory = el.text().trim();
    } else {
      const href = el.attr('href') ?? '';
      const match = href.match(/\/problemset\/task\/(\d+)/);
      if (match) {
        const difficulty = CSES_DIFFICULTY[currentCategory];
        if (difficulty && difficulty !== 'SKIP') {
          problems.push({
            id: match[1]!,
            title: el.text().trim(),
            category: currentCategory,
            difficulty,
          });
        }
      }
    }
  });

  // Deduplicate
  const seen = new Set<string>();
  const unique = problems.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Bias: sort so EASY comes first, then MEDIUM, then HARD
  const order = { EASY: 0, MEDIUM: 1, HARD: 2 };
  unique.sort((a, b) => order[a.difficulty] - order[b.difficulty]);

  const easyCount = unique.filter((p) => p.difficulty === 'EASY').length;
  const medCount = unique.filter((p) => p.difficulty === 'MEDIUM').length;
  const hardCount = unique.filter((p) => p.difficulty === 'HARD').length;
  progress(`━━━ CSES: ${unique.length} problems (${easyCount}E / ${medCount}M / ${hardCount}H) ━━━`);

  let scraped = 0;
  let skipped = 0;

  for (const prob of unique) {
    try {
      await sleep(400); // be polite — 400ms between requests
      const url = `https://cses.fi/problemset/task/${prob.id}`;
      const pageHtml = await fetchWithRetry(url);
      const page$ = cheerio.load(pageHtml);

      // Extract time/memory limits
      const constraints = page$('.task-constraints').text();
      const timeMatch = constraints.match(/Time limit:\s*([\d.]+)\s*s/i);
      const memMatch = constraints.match(/Memory limit:\s*(\d+)\s*MB/i);
      const timeLimitMs = timeMatch ? Math.round(parseFloat(timeMatch[1]!) * 1000) : 1000;
      const memoryLimitMb = memMatch ? parseInt(memMatch[1]!) : 512;

      // Extract statement from <div class="md">
      const mdDiv = page$('div.md').first();
      const descriptionMd = mdDiv.length > 0
        ? htmlToMarkdown(page$, mdDiv[0]!)
        : page$('.content').text().trim().slice(0, 5000);

      // Extract sample I/O — CSES uses <pre> blocks
      const testCases: ScrapedTestCase[] = [];
      const pres = (mdDiv.length > 0 ? mdDiv : page$('div.content')).find('pre');
      const preTexts: string[] = [];
      pres.each((_, pre) => {
        preTexts.push(page$(pre).text().trim());
      });

      for (let i = 0; i + 1 < preTexts.length; i += 2) {
        const input = preTexts[i]!;
        const output = preTexts[i + 1]!;
        if (input && output) {
          testCases.push({
            input,
            expectedOutput: output,
            isSample: true,
            explanation: i === 0 ? `Sample from CSES` : undefined,
          });
        }
      }

      if (testCases.length === 0) {
        skipped++;
        continue;
      }

      await queueImport({
        slug: `cses-${prob.id}`,
        title: prob.title,
        difficulty: prob.difficulty,
        descriptionMd: `## ${prob.title}\n\nSource: [CSES](https://cses.fi/problemset/task/${prob.id})\n\n${descriptionMd}`,
        timeLimitMs,
        memoryLimitMb,
        points: POINTS[prob.difficulty],
        starterCode: { ...DEFAULT_STARTER_CODE },
        testCases,
        source: 'cses',
      });

      scraped++;
      const diffIcon = prob.difficulty === 'EASY' ? '🟢' : prob.difficulty === 'MEDIUM' ? '🟡' : '🔴';
      progress(`  ${diffIcon} [CSES ${scraped}/${unique.length}] ${prob.title} (${prob.difficulty}, ${testCases.length} tests)`);
    } catch (err) {
      progress(`  ✗ [CSES] Failed: ${prob.id} (${prob.title}) — ${err instanceof Error ? err.message : err}`);
      skipped++;
    }
  }

  await flushBatch(); // flush remaining
  progress(`━━━ CSES: Done — ${scraped} scraped, ${skipped} skipped ━━━`);
}

// ─── AtCoder Scraper ──────────────────────────────────────────────────
// AtCoder ABC contests: A,B = EASY, C,D = MEDIUM, E,F,G = HARD
// We bias toward A-D (EASY/MEDIUM) by scraping those letters first.

const ATCODER_DIFFICULTY: Record<string, Difficulty> = {
  A: 'EASY',
  B: 'EASY',
  C: 'MEDIUM',
  D: 'MEDIUM',
  E: 'HARD',
  F: 'HARD',
  G: 'HARD',
};

// Letters in priority order — EASY/MEDIUM first
const ATCODER_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

async function scrapeAtCoder(): Promise<void> {
  progress('━━━ AtCoder: Generating contest list ━━━');

  // Generate ABC contest IDs — ABC 001 to ABC 300
  const contestIds: string[] = [];
  for (let i = 1; i <= 300; i++) {
    contestIds.push(`abc${String(i).padStart(3, '0')}`);
  }

  progress(`━━━ AtCoder: ${contestIds.length} contests to scrape ━━━`);

  let totalScraped = 0;
  let totalSkipped = 0;

  for (let ci = 0; ci < contestIds.length; ci++) {
    const contestId = contestIds[ci]!;
    try {
      await sleep(400);
      const tasksUrl = `https://atcoder.jp/contests/${contestId}/tasks`;
      const tasksHtml = await fetchWithRetry(tasksUrl);
      const tasks$ = cheerio.load(tasksHtml);

      // Find task links — AtCoder puts links in table rows.
      // Each task has a URL like /contests/abc300/tasks/abc300_a
      // The letter is extracted from the URL suffix (_a, _b, etc.)
      const taskUrls: { url: string; letter: string }[] = [];
      const seenTasks = new Set<string>();

      tasks$('a[href*="/tasks/"]').each((_, elem) => {
        const el = tasks$(elem);
        const href = el.attr('href') ?? '';
        // Extract the letter from the URL: abc300_a → a
        const letterMatch = href.match(/_([a-g])$/i);
        if (letterMatch) {
          const letter = letterMatch[1]!.toUpperCase();
          const fullUrl = `https://atcoder.jp${href}`;
          if (!seenTasks.has(fullUrl) && ATCODER_DIFFICULTY[letter]) {
            seenTasks.add(fullUrl);
            taskUrls.push({ url: fullUrl, letter });
          }
        }
      });

      if (taskUrls.length === 0) {
        totalSkipped++;
        continue;
      }

      // Sort tasks by letter priority (EASY/MEDIUM first)
      taskUrls.sort((a, b) => ATCODER_LETTERS.indexOf(a.letter) - ATCODER_LETTERS.indexOf(b.letter));

      for (const task of taskUrls) {
        try {
          await sleep(300);
          const taskHtml = await fetchWithRetry(task.url);
          const task$ = cheerio.load(taskHtml);

          // Extract title — AtCoder puts it in <span class="h2">
          const fullTitle = task$('span.h2').first().text().trim();
          const cleanTitle = fullTitle.replace(/^[A-G]\s*[-—]\s*/, '') || `${contestId} ${task.letter}`;

          // Extract statement
          let statementEl = task$('#task-statement').first();
          if (statementEl.length === 0) {
            statementEl = task$('.task-statement').first();
          }
          const langEn = statementEl.find('.lang-en').first();
          if (langEn.length > 0) {
            statementEl = langEn;
          }

          const descriptionMd = statementEl.length > 0
            ? htmlToMarkdown(task$, statementEl[0]!).slice(0, 10000)
            : `Source: [AtCoder](${task.url})`;

          // Extract sample I/O — AtCoder uses <pre> blocks inside <section> tags
          // Each section has a heading "Sample Input 1" / "Sample Output 1" and a <pre>
          const testCases: ScrapedTestCase[] = [];
          const pres = statementEl.find('pre');
          const preTexts: string[] = [];
          pres.each((_, pre) => {
            preTexts.push(task$(pre).text().trim());
          });

          // AtCoder format: pre blocks alternate input/output
          for (let i = 0; i + 1 < preTexts.length; i += 2) {
            const input = preTexts[i]!;
            const output = preTexts[i + 1]!;
            if (input && output) {
              testCases.push({
                input,
                expectedOutput: output,
                isSample: true,
                explanation: i === 0 ? `Sample from AtCoder` : undefined,
              });
            }
          }

          if (testCases.length === 0) {
            totalSkipped++;
            continue;
          }

          const difficulty = ATCODER_DIFFICULTY[task.letter] ?? 'EASY';

          await queueImport({
            slug: `atcoder-${contestId}-${task.letter.toLowerCase()}`,
            title: `${contestId.toUpperCase()} ${task.letter} - ${cleanTitle}`,
            difficulty,
            descriptionMd: `## ${cleanTitle}\n\nSource: [AtCoder](${task.url})\n\n${descriptionMd}`,
            timeLimitMs: 2000,
            memoryLimitMb: 1024,
            points: POINTS[difficulty],
            starterCode: { ...DEFAULT_STARTER_CODE },
            testCases,
            source: 'atcoder',
          });

          totalScraped++;
          const diffIcon = difficulty === 'EASY' ? '🟢' : difficulty === 'MEDIUM' ? '🟡' : '🔴';
          progress(`  ${diffIcon} [AtCoder ${ci + 1}/${contestIds.length}] ${contestId.toUpperCase()} ${task.letter} — ${cleanTitle} (${difficulty}, ${testCases.length} tests)`);
        } catch {
          totalSkipped++;
        }
      }
    } catch {
      totalSkipped++;
    }
  }

  await flushBatch();
  progress(`━━━ AtCoder: Done — ${totalScraped} scraped, ${totalSkipped} skipped ━━━`);
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const scrapeCsesFlag = args.includes('--cses');
  const scrapeAtcoderFlag = args.includes('--atcoder');
  const scrapeAll = !scrapeCsesFlag && !scrapeAtcoderFlag;

  progress('╔══════════════════════════════════════════════╗');
  progress('║  CP Battle — Problem Scraper                 ║');
  progress('║  Sources: CSES + AtCoder (REAL problems)     ║');
  progress('╚══════════════════════════════════════════════╝');

  const startTime = Date.now();

  if (scrapeAll || scrapeCsesFlag) {
    await scrapeCSES();
  }

  if (scrapeAll || scrapeAtcoderFlag) {
    await scrapeAtCoder();
  }

  // Final summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const dbCount = await db.problem.count();
  const dbEasy = await db.problem.count({ where: { difficulty: 'EASY' } });
  const dbMedium = await db.problem.count({ where: { difficulty: 'MEDIUM' } });
  const dbHard = await db.problem.count({ where: { difficulty: 'HARD' } });

  progress('');
  progress('╔══════════════════════════════════════════════╗');
  progress(`║  COMPLETE — ${elapsed}s elapsed`);
  progress(`║  Imported: ${totalImported} new, ${totalUpdated} updated, ${totalFailed} failed`);
  progress(`║  Database: ${dbCount} total (${dbEasy}E / ${dbMedium}M / ${dbHard}H)`);
  progress('╚══════════════════════════════════════════════╝');

  await db.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  progress(`FATAL: ${err}`);
  process.exit(1);
});
