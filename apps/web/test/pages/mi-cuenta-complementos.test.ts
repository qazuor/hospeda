import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/pages/[lang]/mi-cuenta/complementos/index.astro', 'utf8');
const frontmatter = source.split('---')[1] ?? '';

describe('AC:B10:11 account addon purchase page', () => {
    it('keeps user billing reads in the client island', () => {
        expect(frontmatter).toContain('parseReturnOrderRequestId');
        expect(frontmatter).toContain('Astro.locals.user');
        expect(frontmatter).toContain('const title = t(');
        expect(frontmatter.match(/billingAddonApi|billingSubscriptionApi/g) ?? []).toHaveLength(0);
        expect(source).toContain('<AddonPurchase client:load');
    });
});
