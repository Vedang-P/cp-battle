/**
 * Language registry.
 *
 * Maps our public language IDs (used in the API + UI) to Piston's runtime
 * config. Per-language time/memory multipliers account for slow startups:
 * Java's JVM and Python's interpreter need more headroom than compiled C++.
 *
 * IMPORTANT: `version` must match what piston-bootstrap installs in
 * docker-compose.yml. Bump in both places together.
 */

export type LanguageId = 'cpp' | 'python' | 'java';

export interface LanguageConfig {
  /** Our short id, used in the API and stored on submissions. */
  id: LanguageId;
  /** Display name for the language dropdown. */
  label: string;
  /** File extension Piston should use for the source. */
  extension: string;
  /** Piston `language` field. */
  pistonLanguage: string;
  /** Piston runtime version, MUST match docker-compose bootstrap. */
  pistonVersion: string;
  /** How the code is compiled/run; null = interpreted. */
  compile: { command: string[] } | null;
  /** Command used to run the compiled/interpreted program. */
  run: string[];
  /**
   * Multiplier applied to the problem's base time limit for this language.
   * e.g. Java gets 2x because of JVM warmup. Same idea for memory.
   */
  timeMultiplier: number;
  memoryMultiplier: number;
}

export const LANGUAGES: Record<LanguageId, LanguageConfig> = {
  cpp: {
    id: 'cpp',
    // Judge0 server is GCC 9.2.0 → C++17. (The pistonLanguage/Version/compile
    // fields below are vestigial dead config from the Piston era; the live
    // compiler is set in judge0.ts.)
    label: 'C++ (GCC 9.2, C++17)',
    extension: 'cpp',
    pistonLanguage: 'c++',
    pistonVersion: '12.2.0',
    compile: { command: ['g++', '-std=c++17', '-O2', '-o', 'main', 'main.cpp'] },
    run: ['./main'],
    timeMultiplier: 1,
    memoryMultiplier: 1,
  },
  python: {
    id: 'python',
    // Judge0 server is Python 3.8.1 — NOT 3.10. `match`/`case` and other 3.10+
    // syntax will fail. Keep the label accurate so users don't write 3.10 code.
    label: 'Python (3.8)',
    extension: 'py',
    pistonLanguage: 'python',
    pistonVersion: '3.10.0',
    compile: null,
    run: ['python3', 'main.py'],
    timeMultiplier: 3, // interpreted: ~3x slower
    memoryMultiplier: 2,
  },
  java: {
    id: 'java',
    // Judge0 server is OpenJDK 13.0.1 — NOT 19. Records, sealed classes, and
    // other 14+ features are unavailable or preview-only.
    label: 'Java (OpenJDK 13)',
    extension: 'java',
    pistonLanguage: 'java',
    pistonVersion: '19.0.1',
    // Piston expects the source file named after the public class. We
    // standardise the entry class to `Main` in starter code.
    compile: { command: ['javac', 'Main.java'] },
    run: ['java', 'Main'],
    timeMultiplier: 2, // JVM warmup
    memoryMultiplier: 2,
  },
};

export const ALL_LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];

export function getLanguage(id: string): LanguageConfig | null {
  return (LANGUAGES as Record<string, LanguageConfig>)[id] ?? null;
}
