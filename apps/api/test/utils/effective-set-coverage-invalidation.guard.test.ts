import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', '..', 'src');
const COMPOSITIONS = [
    join(SRC, 'index.ts'),
    join(SRC, 'services', 'cutover-b9a', 'step-3b.compose.ts')
];
const LISTENER_MODULE = join(SRC, 'utils', 'effective-set-coverage-invalidation.ts');

/** Removes block and line comments so a commented-out call never satisfies the guard. */
function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Anchors the call at an identifier boundary, so a longer name (`…X(`) is not accepted. */
function callsFunction(source: string, name: string): boolean {
    return new RegExp(`(?<![\\w$])${name}\\s*\\(`).test(withoutComments(source));
}

describe('TEST:1738:3 AC:1738:1 AC:1738:3 effective-set invalidation is registered', () => {
    describe.each(COMPOSITIONS)('%s', (file) => {
        it('calls subscribeEffectiveSetCoverageInvalidation at composition time', () => {
            const source = readFileSync(file, 'utf8');
            expect(
                callsFunction(source, 'subscribeEffectiveSetCoverageInvalidation'),
                `${basename(file)} must call subscribeEffectiveSetCoverageInvalidation()`
            ).toBe(true);
        });
    });

    it('keeps wiring subscribeCoverageInvalidation in the listener module', () => {
        const source = readFileSync(LISTENER_MODULE, 'utf8');
        expect(
            callsFunction(source, 'subscribeCoverageInvalidation'),
            `${basename(LISTENER_MODULE)} must call subscribeCoverageInvalidation()`
        ).toBe(true);
    });
});
