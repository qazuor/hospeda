import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * HOS-1622 TEST:B13a:14 (support) AC:B13a:14
 *
 * Static assertion that the new-system smoke checklist exists in two parts
 * with its required structure. The test itself runs via the scripts vitest
 * config (`scripts/vitest.config.ts`).
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHECKLIST = path.join(repoRoot, 'docs/billing/smoke-checklist.md');
const source = readFileSync(CHECKLIST, 'utf8');

describe('HOS-1622 TEST:B13a:14 (support) AC:B13a:14 the new-system smoke checklist exists in two parts', () => {
    it('the file exists at docs/billing/smoke-checklist.md', () => {
        expect(source.length).toBeGreaterThan(0);
    });

    it('has the six H2 headings in order', () => {
        const headings = [...source.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
        const expected = [
            'Scope',
            'How to use this checklist',
            'Part 1 — Staging (cutover rehearsal)',
            'Part 2 — Production (cutover step 5c)',
            'Extending this checklist in later phases',
            'Related'
        ];
        for (let i = 0; i < expected.length; i++) {
            expect(headings).toContain(expected[i]);
        }
        // Verify order
        const indices = expected.map((h) => headings.indexOf(h));
        for (let i = 1; i < indices.length; i++) {
            expect(indices[i]).toBeGreaterThan(indices[i - 1]);
        }
    });

    it('Part 1 names TEST:B13a:14, TEST:B3:23, sandbox and the rehearsal', () => {
        const part1Match = source.match(
            /## Part 1 — Staging.*?(?=## Part 2|## Extending|## Related|$)/s
        );
        expect(part1Match).toBeTruthy();
        const part1 = part1Match![0];
        expect(part1).toContain('TEST:B13a:14');
        expect(part1).toContain('TEST:B3:23');
        expect(part1.toLowerCase()).toContain('sandbox');
        expect(part1.toLowerCase()).toContain('rehearsal');
    });

    it('Part 2 names TEST:B13a:15, TEST:B3:36 and the five AC items', () => {
        const part2Match = source.match(/## Part 2 — Production.*?(?=## Extending|## Related|$)/s);
        expect(part2Match).toBeTruthy();
        const part2 = part2Match![0];
        expect(part2).toContain('TEST:B13a:15');
        expect(part2).toContain('TEST:B3:36');
        // Five AC items: real checkout, refund/return, Mercado Pago email, edge cache, cron schedules
        expect(part2.toLowerCase()).toContain('checkout');
        expect(part2.toLowerCase()).toContain('refund');
        expect(part2.toLowerCase()).toContain('mercado pago');
        expect(part2.toLowerCase()).toContain('cache');
        expect(part2.toLowerCase()).toContain('cron');
    });

    it('each part has exactly one sign-off table with the exact header', () => {
        const signoffHeaders = [
            ...source.matchAll(/\| Date \| Executor \| PR \| Result \| Notes \|/g)
        ];
        expect(signoffHeaders.length).toBe(2);
    });

    it('every S* item has the five required lines', () => {
        const itemMatches = [
            ...source.matchAll(/### (S\d+ — .+?)\n([\s\S]*?)(?=### P\d+|### Sign-off|$)/g)
        ];
        for (const [, _id, body] of itemMatches) {
            expect(body).toContain('**Preconditions:**');
            expect(body).toContain('**Steps:**');
            expect(body).toContain('**Expected:**');
            expect(body).toContain('**Evidence:**');
            expect(body).toContain('**Covers:**');
        }
    });

    it('TEST:1685:6 S4 is no longer blocked and names the sweep', () => {
        const s4Match = source.match(/### S4 — Renewal notice\n([\s\S]*?)(?=### S5|$)/);
        expect(s4Match).toBeTruthy();
        const s4 = s4Match![1];
        expect(s4).not.toContain('BLOCKED');
        expect(s4).toContain('billing-reconciliation-sweep');
        expect(s4).toContain('next_charge_at');
    });

    it('every P* item has the five required lines', () => {
        const part2Match = source.match(/## Part 2 — Production.*?(?=## Extending|## Related|$)/s);
        expect(part2Match).toBeTruthy();
        const part2 = part2Match![0];
        const itemMatches = [...part2.matchAll(/### (P\d+ — .+?)\n([\s\S]*?)(?=### Sign-off|$)/g)];
        for (const [, _id, body] of itemMatches) {
            expect(body).toContain('**Preconditions:**');
            expect(body).toContain('**Steps:**');
            expect(body).toContain('**Expected:**');
            expect(body).toContain('**Evidence:**');
            expect(body).toContain('**Covers:**');
        }
    });

    it('every relative link ](…) resolves to an existing file', () => {
        const relativeLinks = [...source.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
        const nonFileLinks = relativeLinks
            .filter(([_match, _label, href]) => {
                // Anchor-only links and external links are OK
                if (href.startsWith('#')) return false;
                if (href.startsWith('http')) return false;
                return true;
            })
            .map(([_match, _label, href]) => href);

        for (const link of nonFileLinks) {
            // Remove anchor if present
            const pathOnly = link.split('#')[0];
            const fullPath = path.resolve(path.dirname(CHECKLIST), pathOnly);
            expect(
                require('node:fs').existsSync(fullPath),
                `${link} does not resolve to an existing file`
            ).toBe(true);
        }
    });

    it('does not name the retired .qtm/ system', () => {
        expect(source).not.toContain('.qtm/');
    });
});
