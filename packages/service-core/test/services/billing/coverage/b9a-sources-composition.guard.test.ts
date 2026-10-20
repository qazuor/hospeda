import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), '../..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('TEST:B9a:12 coverage source composition guard', () => {
    it('keeps GRANT and COURTESY out of B4 sources and composes the real resolvers', () => {
        for (const file of [
            'packages/service-core/src/services/billing/coverage/subscription-sources.ts',
            'packages/service-core/src/services/billing/coverage/addon-sources.ts',
            'packages/service-core/src/services/billing/coverage/can-charge.ts',
            'packages/service-core/src/services/billing/coverage/retention-stopped.ts',
            'packages/service-core/src/services/billing/coverage/coverage-ports.ts'
        ]) {
            expect(read(file)).not.toMatch(/type:\s*['"](?:GRANT|COURTESY)['"]/);
        }
        const composition = read('packages/service-core/src/services/billing/coverage/billing-coverage.ts');
        expect(composition).toContain('resolveCourtesySources');
        expect(composition).toContain('resolveGrantSources');
        for (const file of [
            'packages/service-core/src/services/billing/coverage/grant-sources.ts',
            'packages/service-core/src/services/billing/coverage/courtesy-sources.ts'
        ]) {
            const source = read(file);
            expect(source).not.toContain('@repo/verticals');
            expect(source).not.toMatch(/\b(?:planVersions|plans)\b/);
            expect(source).not.toContain('planPolicy');
        }
    });
});
