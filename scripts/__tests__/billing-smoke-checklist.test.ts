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
            ...source.matchAll(/### (S\d+ — .+?)\n([\s\S]*?)(?=### S\d+|### Sign-off|$)/g)
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
        const s4Start = source.indexOf('### S4 — Renewal notice');
        const s4Match = source
            .slice(s4Start)
            .match(/### (S\d+ — .+?)\n([\s\S]*?)(?=### P\d+|### Sign-off|$)/);
        expect(s4Match).toBeTruthy();
        const s4 = s4Match![2];
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

    it('S21 and P12 close B10 with Q1 deferred and complete evidence lines', () => {
        const covers = [
            'AC:B10:9',
            'AC:B10:10',
            'AC:B10:14',
            'TEST:B10:10',
            'TEST:B10:11',
            'TEST:B10:12',
            'TEST:B10:16'
        ];
        for (const item of ['S21', 'P12']) {
            const body =
                source.match(new RegExp(`### ${item} — [^\\n]+\\n([\\s\\S]*?)(?=### |## )`))?.[1] ??
                '';
            expect(body, item).toContain('**Preconditions:**');
            expect(body, item).toContain('**Steps:**');
            expect(body, item).toContain('**Expected:**');
            expect(body, item).toContain('**Evidence:**');
            expect(body, item).toContain('**Covers:**');
            expect(body, item).toContain('HOS-2094');
            expect(body, item).toContain('Q1 option 3');
            for (const id of covers) expect(body, `${item}: ${id}`).toContain(id);
        }
        expect(source).toContain('Phase 3 (B10, HOS-1373) closes with HOS-1596: S21 and P12.');
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

describe('HOS-2302 refunds are smoked in production only', () => {
    const ruleStart = source.indexOf('## Refunds are smoked in production only (HOS-2302)');
    const part1Start = source.indexOf('## Part 1 — Staging');
    const rule =
        ruleStart === -1 ? '' : source.slice(ruleStart, part1Start === -1 ? undefined : part1Start);
    const p2Match = source.match(
        /### P2 — Refund \(revocation, confirmed refund and addon refund\)\n([\s\S]*?)(?=\n### P3 )/
    );
    const p2 = p2Match?.[1] ?? '';
    const p2Steps = p2.match(/- \*\*Steps:\*\*([\s\S]*?)- \*\*Expected:\*\*/)?.[1] ?? '';
    const s21 = source.match(/### S21 — [^\n]+\n([\s\S]*?)(?=\n### |\n## )/)?.[1] ?? '';

    it('the production-only refunds rule exists as an H2 before Part 1', () => {
        expect(ruleStart, 'the H2 rule section is missing').toBeGreaterThan(-1);
        expect(part1Start, 'Part 1 must come after the rule section').toBeGreaterThan(ruleStart);
    });

    it('the rule cites the literal staging 401 and the staging-safe scope', () => {
        expect(rule, 'the literal 401 error quote is missing').toContain(
            'Unauthorized use of live credentials'
        );
        expect(rule).toContain('401');
        expect(rule).toContain('Part 2');
        expect(rule).toContain('REQUESTED');
        expect(rule).toContain('billing-10-admin-revocation.spec.ts');
        expect(rule).toContain('expected, not a failure');
    });

    it('P2 covers the S36 revocation, the confirmed refund and the addon refund', () => {
        expect(p2Match, 'P2 does not carry the HOS-2302 expanded title').toBeTruthy();
        expect(p2).toContain('S36');
        expect(p2).toContain('DEC-RF-001');
        expect(p2).toContain('action 13 of B6');
        expect(p2).toContain('REQUESTED');
        expect(
            p2Steps,
            'the addon refund step must require the refund to reach its final state'
        ).toMatch(/addon[\s\S]*final state/);
        expect(p2).toContain('HOS-2094');
        expect(p2).toContain('Why here: staging cannot do this');
        expect(p2).toContain('Unauthorized use of live credentials');
    });

    it('S21 no longer promises a real provider refund in staging', () => {
        expect(s21, 'the S21 refund moved-to-production notice is missing').toContain(
            'Refund at the provider: moved to P2 / P12 (HOS-2302); staging answers 401.'
        );
    });
});
