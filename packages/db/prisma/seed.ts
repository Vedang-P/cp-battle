/**
 * Database seed — real competitive programming problems with test cases.
 *
 * Seeds 9 problems (3 per difficulty) with sample + hidden test cases.
 * Idempotent: skips if problems already exist.
 */

import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const problems: Prisma.ProblemCreateInput[] = [
  // ── EASY ──────────────────────────────────────────────────────────────
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'EASY',
    points: 100,
    descriptionMd: `## Two Sum

Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers that add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

Return the answer as two space-separated indices (0-based), in any order.

### Examples

**Input:** nums = [2, 7, 11, 15], target = 9
**Output:** 0 1

**Input:** nums = [3, 2, 4], target = 6
**Output:** 1 2

### Constraints
- 2 ≤ nums.length ≤ 10⁴
- -10⁹ ≤ nums[i] ≤ 10⁹
- Exactly one valid answer exists`,
    starterCode: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, target;
    cin >> n;
    vector<int> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];
    cin >> target;

    // TODO: find two indices that sum to target
    // Print them space-separated

    return 0;
}`,
      python: `n = int(input())
nums = list(map(int, input().split()))
target = int(input())

# TODO: find two indices that sum to target
# Print them space-separated
`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();

        // TODO: find two indices that sum to target
        // Print them space-separated
    }
}`,
    },
    testCases: {
      create: [
        { order: 0, input: '4\n2 7 11 15\n9', expectedOutput: '0 1', isSample: true, explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
        { order: 1, input: '3\n3 2 4\n6', expectedOutput: '1 2', isSample: true },
        { order: 2, input: '2\n3 3\n6', expectedOutput: '0 1', isSample: false },
        { order: 3, input: '4\n1 2 3 4\n7', expectedOutput: '2 3', isSample: false },
        { order: 4, input: '5\n-1 -2 -3 -4 -5\n-8', expectedOutput: '2 4', isSample: false },
        { order: 5, input: '3\n0 4 0\n0', expectedOutput: '0 2', isSample: false },
      ],
    },
  },
  {
    slug: 'reverse-string',
    title: 'Reverse String',
    difficulty: 'EASY',
    points: 100,
    descriptionMd: `## Reverse String

Write a function that reverses a string. The input string is given as a single line.

### Examples

**Input:** hello
**Output:** olleh

**Input:** abcde
**Output:** edcba

### Constraints
- 1 ≤ s.length ≤ 10⁵
- s consists of printable ASCII characters`,
    starterCode: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    string s;
    getline(cin, s);

    // TODO: reverse the string and print it

    return 0;
}`,
      python: `s = input()
# TODO: reverse the string and print it
`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();

        // TODO: reverse the string and print it
    }
}`,
    },
    testCases: {
      create: [
        { order: 0, input: 'hello', expectedOutput: 'olleh', isSample: true },
        { order: 1, input: 'abcde', expectedOutput: 'edcba', isSample: true },
        { order: 2, input: 'A', expectedOutput: 'A', isSample: false },
        { order: 3, input: 'abcdefg', expectedOutput: 'gfedcba', isSample: false },
        { order: 4, input: '12345', expectedOutput: '54321', isSample: false },
        { order: 5, input: 'nooneatscats', expectedOutput: 'stacstaenoon', isSample: false },
      ],
    },
  },
  {
    slug: 'max-subarray',
    title: 'Maximum Subarray',
    difficulty: 'EASY',
    points: 100,
    descriptionMd: `## Maximum Subarray

Given an integer array \`nums\`, find the subarray with the largest sum and return its sum.

### Examples

**Input:** [-2, 1, -3, 4, -1, 2, 1, -5, 4]
**Output:** 6

**Input:** [1]
**Output:** 1

**Input:** [5, 4, -1, 7, 8]
**Output:** 23

### Constraints
- 1 ≤ nums.length ≤ 10⁵
- -10⁴ ≤ nums[i] ≤ 10⁴`,
    starterCode: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    cin >> n;
    vector<int> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];

    // TODO: find and print the maximum subarray sum

    return 0;
}`,
      python: `n = int(input())
nums = list(map(int, input().split()))

# TODO: find and print the maximum subarray sum
`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();

        // TODO: find and print the maximum subarray sum
    }
}`,
    },
    testCases: {
      create: [
        { order: 0, input: '9\n-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6', isSample: true, explanation: '[4, -1, 2, 1] has sum 6' },
        { order: 1, input: '1\n1', expectedOutput: '1', isSample: true },
        { order: 2, input: '5\n5 4 -1 7 8', expectedOutput: '23', isSample: true },
        { order: 3, input: '3\n-1 -2 -3', expectedOutput: '-1', isSample: false },
        { order: 4, input: '4\n1 2 3 4', expectedOutput: '10', isSample: false },
        { order: 5, input: '6\n-3 -2 -1 -4 -5 -6', expectedOutput: '-1', isSample: false },
      ],
    },
  },

  // ── MEDIUM ────────────────────────────────────────────────────────────
  {
    slug: 'lru-cache',
    title: 'LRU Cache',
    difficulty: 'MEDIUM',
    points: 200,
    descriptionMd: `## LRU Cache

Design a data structure that follows the constraints of a **Least Recently Used (LRU) cache**.

Implement the \`LRUCache\` class:
- \`LRUCache(capacity)\` — initialize with positive capacity.
- \`get(key)\` — return the value of the key if it exists, otherwise return -1.
- \`put(key, value)\` — update the value. If the key doesn't exist, add it. When capacity is reached, evict the least recently used key.

The functions \`get\` and \`put\` must each run in **O(1)** average time.

### Input Format

First line: capacity
Following lines: operations — \`GET key\` or \`PUT key value\`

Output the result of each GET operation, one per line.

### Examples

**Input:**
2
PUT 1 1
PUT 2 2
GET 1
PUT 3 3
GET 2

**Output:**
1
-1

### Constraints
- 1 ≤ capacity ≤ 3000
- 0 ≤ key ≤ 10⁴
- 0 ≤ value ≤ 10⁵
- At most 2 × 10⁵ calls to get and put`,
    starterCode: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

// TODO: implement LRUCache with O(1) get and put

int main() {
    int cap;
    cin >> cap;

    string op;
    while (cin >> op) {
        if (op == "GET") {
            int key; cin >> key;
            // TODO: implement get, print result
            cout << -1 << endl;
        } else if (op == "PUT") {
            int key, val; cin >> key >> val;
            // TODO: implement put
        }
    }
    return 0;
}`,
      python: `import sys
from collections import OrderedDict

cap = int(input())

# TODO: implement LRUCache

for line in sys.stdin:
    parts = line.strip().split()
    if not parts: break
    op = parts[0]
    if op == "GET":
        key = int(parts[1])
        # TODO: implement get
        print(-1)
    elif op == "PUT":
        key, val = int(parts[1]), int(parts[2])
        # TODO: implement put
`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int cap = sc.nextInt();

        // TODO: implement LRUCache

        while (sc.hasNext()) {
            String op = sc.next();
            if (op.equals("GET")) {
                int key = sc.nextInt();
                System.out.println(-1);
            } else if (op.equals("PUT")) {
                int key = sc.nextInt(), val = sc.nextInt();
                // TODO: implement put
            }
        }
    }
}`,
    },
    testCases: {
      create: [
        { order: 0, input: '2\nPUT 1 1\nPUT 2 2\nGET 1\nPUT 3 3\nGET 2', expectedOutput: '1\n-1', isSample: true },
        { order: 1, input: '1\nPUT 1 1\nPUT 2 2\nGET 1\nPUT 3 3\nGET 2\nGET 3', expectedOutput: '-1\n-1\n3', isSample: false },
        { order: 2, input: '2\nPUT 1 10\nPUT 2 20\nGET 1\nPUT 3 30\nGET 2\nPUT 4 40\nGET 1\nGET 3', expectedOutput: '10\n-1\n-1\n30', isSample: false },
        { order: 3, input: '3\nPUT 1 1\nPUT 2 2\nPUT 3 3\nGET 1\nPUT 4 4\nGET 1\nGET 2\nGET 3', expectedOutput: '1\n1\n-1\n3', isSample: false },
        { order: 4, input: '2\nPUT 1 1\nPUT 2 2\nGET 2\nPUT 3 3\nGET 1\nGET 3', expectedOutput: '2\n-1\n3', isSample: false },
      ],
    },
  },
  {
    slug: 'word-search',
    title: 'Word Search',
    difficulty: 'MEDIUM',
    points: 200,
    descriptionMd: `## Word Search

Given an \`m x n\` grid of characters \`board\` and a string \`word\`, return \`true\` if \`word\` exists in the grid.

The word can be constructed from letters of sequentially adjacent cells (horizontally or vertically). The same cell may not be used more than once.

### Input Format

First line: m n
Next m lines: board rows (strings of length n)
Last line: word

### Examples

**Input:**
3 4
ABCE
SFCS
ADEE
ABCCED

**Output:** true

**Input:**
2 2
AB
CD
ABC

**Output:** false

### Constraints
- m, n ≥ 1
- board and word consist of uppercase and lowercase English letters
- 1 ≤ word.length ≤ 15`,
    starterCode: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

// TODO: implement word search using DFS/backtracking

int main() {
    int m, n;
    cin >> m >> n;
    vector<string> board(m);
    for (int i = 0; i < m; i++) cin >> board[i];
    string word;
    cin >> word;

    // TODO: search for word in board, print true or false

    return 0;
}`,
      python: `m, n = map(int, input().split())
board = [input() for _ in range(m)]
word = input()

# TODO: search for word in board, print True or False
`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int m = sc.nextInt(), n = sc.nextInt();
        char[][] board = new char[m][n];
        for (int i = 0; i < m; i++) board[i] = sc.next().toCharArray();
        String word = sc.next();

        // TODO: search for word in board, print true or false
    }
}`,
    },
    testCases: {
      create: [
        { order: 0, input: '3 4\nABCE\nSFCS\nADEE\nABCCED', expectedOutput: 'true', isSample: true },
        { order: 1, input: '2 2\nAB\nCD\nABC', expectedOutput: 'false', isSample: true },
        { order: 2, input: '1 1\nA\nA', expectedOutput: 'true', isSample: false },
        { order: 3, input: '1 1\nA\nB', expectedOutput: 'false', isSample: false },
        { order: 4, input: '2 3\nABC\nDEF\nABF', expectedOutput: 'false', isSample: false },
        { order: 5, input: '3 3\nAAA\nAAA\nAAA\nAAAAAAAAA', expectedOutput: 'true', isSample: false },
      ],
    },
  },
  {
    slug: 'interval-merge',
    title: 'Merge Intervals',
    difficulty: 'MEDIUM',
    points: 200,
    descriptionMd: `## Merge Intervals

Given an array of intervals where \`intervals[i] = [start_i, end_i]\`, merge all overlapping intervals and return an array of the non-overlapping intervals.

### Input Format

First line: n (number of intervals)
Next n lines: start end

### Examples

**Input:**
4
1 3
2 6
8 10
15 18

**Output:**
1 6
8 10
15 18

**Input:**
2
1 4
4 5

**Output:**
1 5

### Constraints
- 1 ≤ intervals.length ≤ 10⁴
- intervals[i].length == 2
- 0 ≤ start ≤ end ≤ 10⁴`,
    starterCode: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    cin >> n;
    vector<pair<int,int>> intervals(n);
    for (int i = 0; i < n; i++) cin >> intervals[i].first >> intervals[i].second;

    // TODO: sort by start, merge overlaps, print result

    return 0;
}`,
      python: `n = int(input())
intervals = []
for _ in range(n):
    s, e = map(int, input().split())
    intervals.append((s, e))

# TODO: sort by start, merge overlaps, print result
`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[][] intervals = new int[n][2];
        for (int i = 0; i < n; i++) {
            intervals[i][0] = sc.nextInt();
            intervals[i][1] = sc.nextInt();
        }

        // TODO: sort by start, merge overlaps, print result
    }
}`,
    },
    testCases: {
      create: [
        { order: 0, input: '4\n1 3\n2 6\n8 10\n15 18', expectedOutput: '1 6\n8 10\n15 18', isSample: true },
        { order: 1, input: '2\n1 4\n4 5', expectedOutput: '1 5', isSample: true },
        { order: 2, input: '1\n1 1', expectedOutput: '1 1', isSample: false },
        { order: 3, input: '2\n1 4\n0 4', expectedOutput: '0 4', isSample: false },
        { order: 4, input: '3\n1 2\n3 4\n5 6', expectedOutput: '1 2\n3 4\n5 6', isSample: false },
        { order: 5, input: '4\n1 10\n2 3\n4 5\n6 7', expectedOutput: '1 10', isSample: false },
      ],
    },
  },

  // ── HARD ──────────────────────────────────────────────────────────────
  {
    slug: 'median-of-stream',
    title: 'Median of a Stream',
    difficulty: 'HARD',
    points: 350,
    descriptionMd: `## Median of a Stream

Design a data structure that finds the **median** of a stream of integers.

Implement:
- Add integer to the data structure.
- After each addition, output the current median.

### Input Format

First line: n
Next n lines: one integer per line

Output the median after each insertion (rounded down to nearest integer).

### Examples

**Input:**
5
5
15
1
3
8

**Output:**
5
10
5
4
5

### Constraints
- 1 ≤ n ≤ 10⁵
- -10⁹ ≤ value ≤ 10⁹
- Median of [a₁,...,aₖ] is the middle element when sorted (or the lower middle for even k)`,
    starterCode: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

// TODO: use two heaps (max-heap for lower half, min-heap for upper half)

int main() {
    int n;
    cin >> n;

    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        // TODO: insert x and print current median
    }
    return 0;
}`,
      python: `import heapq

n = int(input())

# TODO: use two heaps for running median

for _ in range(n):
    x = int(input())
    # TODO: insert x and print current median
`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();

        // TODO: use two priority queues for running median

        for (int i = 0; i < n; i++) {
            int x = sc.nextInt();
            // TODO: insert x and print current median
        }
    }
}`,
    },
    testCases: {
      create: [
        { order: 0, input: '5\n5\n15\n1\n3\n8', expectedOutput: '5\n10\n5\n4\n5', isSample: true },
        { order: 1, input: '4\n2\n1\n5\n7', expectedOutput: '2\n1\n2\n3', isSample: false },
        { order: 2, input: '1\n42', expectedOutput: '42', isSample: false },
        { order: 3, input: '6\n-1\n-2\n-3\n0\n1\n2', expectedOutput: '-1\n-1\n-2\n-1\n-1\n0', isSample: false },
        { order: 4, input: '5\n1\n1\n1\n1\n1', expectedOutput: '1\n1\n1\n1\n1', isSample: false },
        { order: 5, input: '8\n10\n20\n30\n40\n50\n60\n70\n80', expectedOutput: '10\n15\n20\n25\n30\n35\n40\n45', isSample: false },
      ],
    },
  },
  {
    slug: 'alien-dictionary',
    title: 'Alien Dictionary',
    difficulty: 'HARD',
    points: 350,
    descriptionMd: `## Alien Dictionary

Given a sorted list of words from an alien language, derive the character ordering.

### Input Format

First line: n (number of words)
Next n lines: words in lexicographic order

Output the unique characters in order (as a string with no spaces). If no valid order exists, output -1.

### Examples

**Input:**
3
wrt
wrf
er

**Output:** wertf

**Input:**
2
abc
ab

**Output:** -1

### Constraints
- 1 ≤ n ≤ 100
- 1 ≤ word.length ≤ 20
- All words consist of lowercase English letters
- The ordering is valid for the given words`,
    starterCode: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

// TODO: build graph from adjacent word pairs, topological sort

int main() {
    int n;
    cin >> n;
    vector<string> words(n);
    for (int i = 0; i < n; i++) cin >> words[i];

    // TODO: derive character order, print result or -1

    return 0;
}`,
      python: `from collections import defaultdict, deque

n = int(input())
words = [input() for _ in range(n)]

# TODO: build graph, topological sort, print result or -1
`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        String[] words = new String[n];
        for (int i = 0; i < n; i++) words[i] = sc.next();

        // TODO: build graph, topological sort, print result or -1
    }
}`,
    },
    testCases: {
      create: [
        { order: 0, input: '3\nwrt\nwrf\ner', expectedOutput: 'wtrfe', isSample: true },
        { order: 1, input: '2\nabc\nab', expectedOutput: '-1', isSample: true },
        { order: 2, input: '1\na', expectedOutput: 'a', isSample: false },
        { order: 3, input: '3\nabc\ndef\nghi', expectedOutput: 'ihfecbadg', isSample: false },
        { order: 4, input: '4\nba\nbc\nac\nca', expectedOutput: 'bac', isSample: false },
        { order: 5, input: '5\nzyx\nwvu\nuts\nrqo\npon', expectedOutput: 'zyxwvutsrqpon', isSample: false },
      ],
    },
  },
  {
    slug: 'max-rectangle',
    title: 'Maximal Rectangle',
    difficulty: 'HARD',
    points: 350,
    descriptionMd: `## Maximal Rectangle

Given a \`m x n\` binary matrix filled with 0s and 1s, find the largest rectangle containing only 1s and return its area.

### Input Format

First line: m n
Next m lines: rows of 0s and 1s (no spaces)

### Examples

**Input:**
3 5
10100
10111
11111

**Output:** 6

**Input:**
2 2
10
11

**Output:** 2

### Constraints
- m, n ≥ 1
- matrix[i][j] is '0' or '1'`,
    starterCode: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

// TODO: use histogram approach per row with stack-based largest rectangle

int main() {
    int m, n;
    cin >> m >> n;
    vector<string> grid(m);
    for (int i = 0; i < m; i++) cin >> grid[i];

    // TODO: find maximal rectangle of 1s, print area

    return 0;
}`,
      python: `m, n = map(int, input().split())
grid = [input() for _ in range(m)]

# TODO: find maximal rectangle of 1s, print area
`,
      java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int m = sc.nextInt(), n = sc.nextInt();
        char[][] grid = new char[m][n];
        for (int i = 0; i < m; i++) grid[i] = sc.next().toCharArray();

        // TODO: find maximal rectangle of 1s, print area
    }
}`,
    },
    testCases: {
      create: [
        { order: 0, input: '3 5\n10100\n10111\n11111', expectedOutput: '6', isSample: true },
        { order: 1, input: '2 2\n10\n11', expectedOutput: '2', isSample: true },
        { order: 2, input: '1 1\n1', expectedOutput: '1', isSample: false },
        { order: 3, input: '1 1\n0', expectedOutput: '0', isSample: false },
        { order: 4, input: '2 4\n1111\n1111', expectedOutput: '8', isSample: false },
        { order: 5, input: '3 3\n110\n110\n110', expectedOutput: '6', isSample: false },
      ],
    },
  },
];

async function main() {
  const count = await prisma.problem.count();
  if (count > 0) {
    console.log(`[seed] ${count} problems already exist — skipping seed.`);
    return;
  }

  console.log('[seed] Seeding 9 problems with test cases...');

  for (const problem of problems) {
    await prisma.problem.create({ data: problem });
    console.log(`  ✓ ${problem.slug} (${problem.difficulty})`);
  }

  const total = await prisma.problem.count();
  const cases = await prisma.testCase.count();
  console.log(`[seed] Done. ${total} problems, ${cases} test cases.`);
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
