import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../../../../..');
const BILLING = join(ROOT, 'packages/service-core/src/services/billing');

function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : name.endsWith('.ts') ? [path] : [];
    });
}

function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, '$1');
}

const callers = files(BILLING)
    .map((path) => ({
        path: relative(BILLING, path),
        code: stripComments(readFileSync(path, 'utf8'))
    }))
    .filter(
        ({ path, code }) =>
            path !== 'subscription/activate-pending-with-signup-notice.ts' &&
            /\bactivatePendingWithSignupNotice\s*\(/.test(code)
    );

describe('TEST:1741:4 every S2 activation has the shared post-commit step', () => {
    it('finds all activation sites and each runs afterSubscriptionActivated', () => {
        expect(callers.length).toBeGreaterThanOrEqual(3);
        expect(
            callers.filter(({ code }) => /\bafterSubscriptionActivated\s*\(/.test(code))
        ).toHaveLength(callers.length);
        expect(callers.map(({ path }) => path)).toEqual(
            expect.arrayContaining([
                'notice/process-provider-notice.service.ts',
                'subscription/activate-subscription.service.ts',
                'subscription/expire-authorization-windows.service.ts'
            ])
        );
    });

    it('does not count commented calls', () => {
        expect(
            /\bafterSubscriptionActivated\s*\(/.test(
                stripComments('// afterSubscriptionActivated(')
            )
        ).toBe(false);
    });
});
