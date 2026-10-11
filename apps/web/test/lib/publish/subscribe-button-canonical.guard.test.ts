import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(__dirname, '../../../src');
const resolverPath = resolve(sourceRoot, 'lib/publish/subscribe-button.ts');

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory()
            ? sourceFiles(path)
            : /\.(astro|tsx?|jsx?)$/.test(entry.name)
              ? [path]
              : [];
    });
}

describe('subscribe destination canonical guard (AC:V8a:1)', () => {
    it('keeps destination dispatch literals inside the resolver', () => {
        const violations = sourceFiles(sourceRoot)
            .filter((path) => path !== resolverPath)
            .flatMap((path) => {
                const source = readFileSync(path, 'utf8');
                return /\.destination\s*(?:===|==|!==|!=)\s*['"](?:PUBLISH|CHECKOUT|NO_PLANS_AVAILABLE|COVERED)['"]/.test(
                    source
                )
                    ? [path.replace(`${sourceRoot}/`, '')]
                    : [];
            });
        expect(violations).toEqual([]);
    });

    it('does not derive no-plans from plan lists or trial days in either island', () => {
        const subscribe = readFileSync(
            resolve(sourceRoot, 'components/billing/SubscribeButton.client.tsx'),
            'utf8'
        );
        const publish = readFileSync(
            resolve(sourceRoot, 'components/host/PublishButton.client.tsx'),
            'utf8'
        );
        for (const source of [subscribe, publish]) {
            expect(source).not.toMatch(/(?:plans?\.length|trialDays\s*(?:>|<|===|!==))/);
        }
    });
});
