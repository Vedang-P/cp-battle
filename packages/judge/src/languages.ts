/**
 * Language registry.
 *
 * Maps our public language IDs (used in the API + UI) to the per-language
 * time/memory multipliers. These account for slow startups: Java's JVM and
 * Python's interpreter need more headroom than compiled C++.
 *
 * The actual compiler/runtime lives on the Judge0 server (see judge0.ts for
 * the Judge0 language IDs and compiler options). Labels below reflect the
 * versions the live Judge0 server actually runs — keep them accurate so users
 * don't write syntax their target version doesn't support.
 */

export type LanguageId = 'cpp' | 'python' | 'java';

export interface LanguageConfig {
  /** Our short id, used in the API and stored on submissions. */
  id: LanguageId;
  /** Display name for the language dropdown. */
  label: string;
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
    // Judge0 server is GCC 9.2.0 → C++17 (the compiler flag is set in judge0.ts).
    label: 'C++ (GCC 9.2, C++17)',
    timeMultiplier: 1,
    memoryMultiplier: 1,
  },
  python: {
    id: 'python',
    // Judge0 server is Python 3.8.1 — NOT 3.10. `match`/`case` and other 3.10+
    // syntax will fail. Keep the label accurate so users don't write 3.10 code.
    label: 'Python (3.8)',
    timeMultiplier: 3, // interpreted: ~3x slower
    memoryMultiplier: 2,
  },
  java: {
    id: 'java',
    // Judge0 server is OpenJDK 13.0.1 — NOT 19. Records, sealed classes, and
    // other 14+ features are unavailable or preview-only.
    label: 'Java (OpenJDK 13)',
    timeMultiplier: 2, // JVM warmup
    memoryMultiplier: 2,
  },
};

export const ALL_LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];

export function getLanguage(id: string): LanguageConfig | null {
  return (LANGUAGES as Record<string, LanguageConfig>)[id] ?? null;
}
