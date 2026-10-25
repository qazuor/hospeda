import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES = [
    join(import.meta.dirname, '../../src/routes/accommodation/admin/moderate.ts'),
    join(import.meta.dirname, '../../src/routes/gastronomy/admin/moderate.ts'),
    join(import.meta.dirname, '../../src/routes/experience/admin/moderate.ts'),
    join(import.meta.dirname, '../../src/routes/accommodation/admin/moderation-state.ts'),
    join(import.meta.dirname, '../../src/routes/gastronomy/admin/moderation-state.ts'),
    join(import.meta.dirname, '../../src/routes/experience/admin/moderation-state.ts')
];

describe('TEST:V6:12 listing moderation permission guard', () => {
    it('TEST:V6:12 uses LISTING_MODERATE and never a vertical moderation permission', () => {
        for (const route of ROUTES) {
            const source = readFileSync(route, 'utf8');
            expect(source).toMatch(/\bLISTING_MODERATE\b/);
            expect(source).not.toMatch(
                /\b(?:ACCOMMODATION|GASTRONOMY|EXPERIENCE)_MODERATION_CHANGE\b/
            );
        }
    });

    it('TEST:V6:12 keeps Partner presence moderation outside the listing levels', () => {
        const partnersRoot = join(import.meta.dirname, '../../src/routes/partners');
        const source = readdirSync(partnersRoot, { recursive: true })
            .filter((path): path is string => typeof path === 'string' && path.endsWith('.ts'))
            .map((path) => readFileSync(join(partnersRoot, path), 'utf8'))
            .join('\n');
        expect(source).not.toMatch(/\bListingModerationActionSchema\b/);
    });
});
