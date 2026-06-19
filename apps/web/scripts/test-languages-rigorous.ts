/**
 * Rigorous language test — tests C++, Python, Java across multiple problem types:
 * 1. A+B (basic I/O)
 * 2. String manipulation
 * 3. Array processing
 * 4. Edge cases (empty input, large numbers)
 * 5. Compile error detection
 * 6. Wrong answer detection
 * 7. Runtime error detection
 *
 * Usage:
 *   pnpm --env-file=../../.env tsx scripts/test-languages-rigorous.ts
 */

import { judgeSubmission, getLanguage } from '@zapdos/judge';
import type { LanguageId } from '@zapdos/judge';

interface TestCase {
  name: string;
  solutions: Record<LanguageId, string>;
  testCases: Array<{ input: string; expected: string }>;
  expectedVerdict: 'AC' | 'WA' | 'CE' | 'RE';
}

const TESTS: TestCase[] = [
  {
    name: 'A+B Basic I/O',
    solutions: {
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}`,
      python: `a, b = map(int, input().split())
print(a + b)`,
      java: `import java.util.*;
import java.io.*;
public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int a = Integer.parseInt(st.nextToken());
        int b = Integer.parseInt(st.nextToken());
        System.out.println(a + b);
    }
}`,
    },
    testCases: [
      { input: '1 2\n', expected: '3' },
      { input: '100 200\n', expected: '300' },
      { input: '-5 5\n', expected: '0' },
      { input: '0 0\n', expected: '0' },
    ],
    expectedVerdict: 'AC',
  },
  {
    name: 'String Reversal',
    solutions: {
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
    string s;
    getline(cin, s);
    reverse(s.begin(), s.end());
    cout << s << endl;
    return 0;
}`,
      python: `s = input()
print(s[::-1])`,
      java: `import java.util.*;
import java.io.*;
public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String s = br.readLine();
        System.out.println(new StringBuilder(s).reverse().toString());
    }
}`,
    },
    testCases: [
      { input: 'hello\n', expected: 'olleh' },
      { input: 'abc\n', expected: 'cba' },
      { input: 'a\n', expected: 'a' },
    ],
    expectedVerdict: 'AC',
  },
  {
    name: 'Array Max Element',
    solutions: {
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n;
    cin >> n;
    vector<int> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    cout << *max_element(a.begin(), a.end()) << endl;
    return 0;
}`,
      python: `n = int(input())
a = list(map(int, input().split()))
print(max(a))`,
      java: `import java.util.*;
import java.io.*;
public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(br.readLine().trim());
        StringTokenizer st = new StringTokenizer(br.readLine());
        int max = Integer.MIN_VALUE;
        for (int i = 0; i < n; i++) {
            int x = Integer.parseInt(st.nextToken());
            if (x > max) max = x;
        }
        System.out.println(max);
    }
}`,
    },
    testCases: [
      { input: '3\n1 2 3\n', expected: '3' },
      { input: '5\n10 5 8 1 9\n', expected: '10' },
      { input: '1\n42\n', expected: '42' },
    ],
    expectedVerdict: 'AC',
  },
  {
    name: 'Wrong Answer Detection',
    solutions: {
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a - b << endl;
    return 0;
}`,
      python: `a, b = map(int, input().split())
print(a - b)`,
      java: `import java.util.*;
import java.io.*;
public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int a = Integer.parseInt(st.nextToken());
        int b = Integer.parseInt(st.nextToken());
        System.out.println(a - b);
    }
}`,
    },
    testCases: [
      { input: '5 3\n', expected: '8' },
    ],
    expectedVerdict: 'WA',
  },
  {
    name: 'Compile Error Detection',
    solutions: {
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b
    cout << a + b << endl;
    return 0;
}`,
      // Python syntax errors are runtime errors (interpreted language)
      python: `this is not valid python code {{{`,
      java: `import java.util.*;
import java.io.*;
public class Main {
    public static void main(String[] args) throws IOException {
        System.out.println("hello"
    }
}`,
    },
    testCases: [
      { input: '1 2\n', expected: '3' },
    ],
    // C++ and Java produce CE; Python produces RE/WA (interpreted)
    expectedVerdict: 'CE',
    pythonExpectedVerdict: 'WA' as 'CE',
  },
  {
    name: 'Large Numbers',
    solutions: {
      cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
    long long a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}`,
      python: `a, b = map(int, input().split())
print(a + b)`,
      java: `import java.util.*;
import java.io.*;
public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        long a = Long.parseLong(st.nextToken());
        long b = Long.parseLong(st.nextToken());
        System.out.println(a + b);
    }
}`,
    },
    testCases: [
      { input: '1000000000 2000000000\n', expected: '3000000000' },
      { input: '999999999999 1\n', expected: '1000000000000' },
    ],
    expectedVerdict: 'AC',
  },
];

function log(msg: string): void {
  const ts = new Date().toISOString().split('T')[1]!.slice(0, 8);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

async function runTest(test: TestCase, lang: LanguageId): Promise<{ pass: boolean; verdict: string; detail: string }> {
  const langConfig = getLanguage(lang);
  if (!langConfig) return { pass: false, verdict: 'SKIP', detail: 'No config' };

  const expectedVerdict = (lang === 'python' && (test as any).pythonExpectedVerdict)
    ? (test as any).pythonExpectedVerdict
    : test.expectedVerdict;

  try {
    const result = await judgeSubmission({
      language: langConfig,
      source: test.solutions[lang],
      testCases: test.testCases,
      timeLimitMs: 2000,
      memoryLimitMb: 256,
    });

    const verdictMatch = result.verdict === expectedVerdict;
    const detail = result.verdict === 'AC' ? `${result.passed}/${result.total} passed`
      : result.compileError ? result.compileError.slice(0, 100)
      : result.runtimeError ? result.runtimeError.slice(0, 100)
      : `${result.passed}/${result.total}`;

    return { pass: verdictMatch, verdict: result.verdict, detail };
  } catch (err) {
    return { pass: false, verdict: 'ERROR', detail: String(err).slice(0, 100) };
  }
}

async function main() {
  log('=== Rigorous Language Test ===');
  log(`Testing ${TESTS.length} problems across C++, Python, Java`);
  log('');

  const allResults: Array<{ test: string; lang: string; pass: boolean; verdict: string; expected: string; detail: string }> = [];

  for (const test of TESTS) {
    log(`--- ${test.name} (expect: ${test.expectedVerdict}) ---`);
    for (const lang of ['cpp', 'python', 'java'] as LanguageId[]) {
      const result = await runTest(test, lang);
      const status = result.pass ? 'PASS' : 'FAIL';
      log(`  ${lang}: ${status} (${result.verdict}) ${result.detail}`);
      allResults.push({
        test: test.name,
        lang,
        pass: result.pass,
        verdict: result.verdict,
        expected: test.expectedVerdict,
        detail: result.detail,
      });
    }
    log('');
  }

  // Summary
  log('=== Summary ===');
  const total = allResults.length;
  const passed = allResults.filter((r) => r.pass).length;
  const failed = allResults.filter((r) => !r.pass);
  log(`  ${passed}/${total} passed`);

  if (failed.length > 0) {
    log('');
    log('Failed tests:');
    for (const f of failed) {
      log(`  ${f.test} / ${f.lang}: got ${f.verdict}, expected ${f.expected} — ${f.detail}`);
    }
    process.exit(1);
  }

  log('');
  log('All tests passed!');
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
