/**
 * What a shared case set needs from the test runner. The case sets receive
 * `describe`, `it` and `expect` as parameters, so this package never depends
 * on a test framework: vitest's own functions satisfy these shapes.
 */

/** Registers a group of cases. */
export type CaseDescribe = (name: string, body: () => void) => void;

/** Registers one case. */
export type CaseIt = (name: string, body: () => Promise<void>) => void;

/** The assertions the case sets use. */
export interface CaseAssertion {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
}

/** Starts an assertion; the message is shown when it fails. */
export type CaseExpect = (actual: unknown, message?: string) => CaseAssertion;

/** The three runner functions a case set registers its cases with. */
export interface CaseRunner {
    readonly describe: CaseDescribe;
    readonly it: CaseIt;
    readonly expect: CaseExpect;
}
