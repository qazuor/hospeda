import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * HOS-2112 guard: the fake provider clock is never compared with real time.
 *
 * `FakeProviderRequest.at` is a timestamp from the fake provider's adjustable
 * clock (`packages/payments/src/fake-server/fake-provider-server.ts`). That clock
 * runs ahead of real time while a spec is being set up, so comparing `.at` with a
 * real timestamp (for example `mail.receivedAt`) always passes and proves nothing.
 * The correct shape is to locate the request by its position in
 * `fakeServer.requests().slice(requestsBefore)` and compare real time with real
 * time. `billing-27-plan-migration-end-to-end.spec.ts` shows that pattern.
 *
 * What this guard does NOT see — read this before trusting its green:
 * - an intermediate variable: `const at = request.at; new Date(at)`;
 * - a `Date.parse` applied to a differently named alias;
 * - a comparison written inside a `fixtures/` helper with another syntactic shape.
 * It only scans the text of `tests/**\/*.ts` and `fixtures/**\/*.ts`.
 */

const E2E_ROOT = join(import.meta.dirname, '..', '..');
const SCAN_DIRS = [join(E2E_ROOT, 'tests'), join(E2E_ROOT, 'fixtures')];

const FORBIDDEN = [
    /new Date\(\s*[\w$.!?[\]]+\.at\s*\)\s*\.getTime\(\)/,
    /Date\.parse\(\s*[\w$.!?[\]]+\.at\s*\)/
] as const;

function readScannedSources(): ReadonlyArray<{ readonly file: string; readonly source: string }> {
    const sources: Array<{ file: string; source: string }> = [];
    const walk = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const file = join(directory, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (entry.name.endsWith('.ts')) {
                sources.push({
                    file: file.slice(E2E_ROOT.length + 1),
                    source: readFileSync(file, 'utf8')
                });
            }
        }
    };
    for (const directory of SCAN_DIRS) walk(directory);
    return sources;
}

describe('HOS-2112 the fake provider clock is never compared with real time', () => {
    it('the forbidden patterns match the shape that hid the bug', () => {
        // Arrange
        const oldShapes = [
            'expect(mail.receivedAt.getTime()).toBeLessThan(new Date(requests[0]!.at).getTime());',
            ').toBeLessThan(new Date(cancelRequest!.at).getTime());',
            ').toBeLessThan(new Date(cancellations[0]!.at).getTime());'
        ];
        const allowed = 'uiDate(new Date(body.data.nextCharge.at))';

        // Act
        const matches = [...oldShapes, allowed].map((line) =>
            FORBIDDEN.some((pattern) => pattern.test(line))
        );

        // Assert
        expect(matches).toEqual([true, true, true, false]);
    });

    it('no spec or fixture compares a fake request time', () => {
        // Arrange
        const sources = readScannedSources();

        // Act
        const offenders = sources.flatMap(({ file, source }) =>
            source
                .split('\n')
                .map((line, index) => ({ line, lineNumber: index + 1 }))
                .filter(({ line }) => FORBIDDEN.some((pattern) => pattern.test(line)))
                .map(({ lineNumber }) => `${file}:${lineNumber}`)
        );

        // Assert
        expect(
            offenders,
            'HOS-2112: never compare `FakeProviderRequest.at` (the fake provider clock) with a ' +
                'real time. Locate the request by position in ' +
                '`fakeServer.requests().slice(requestsBefore)` and compare real time with real ' +
                'time, as billing-27-plan-migration-end-to-end.spec.ts does.'
        ).toEqual([]);
        expect(sources.length).toBeGreaterThan(20);
    });
});
