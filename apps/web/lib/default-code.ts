/**
 * Default starter code for each language.
 * Single source of truth — imported by battle page, import scripts, etc.
 */

export type LanguageId = 'cpp' | 'python' | 'java';

export const DEFAULT_CODE: Record<LanguageId, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    return 0;
}`,
  python: `import sys
input = sys.stdin.readline

def solve():
    n = int(input())
    # Your solution here

if __name__ == "__main__":
    solve()`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(br.readLine().trim());
        // Your solution here
    }
}`,
};
