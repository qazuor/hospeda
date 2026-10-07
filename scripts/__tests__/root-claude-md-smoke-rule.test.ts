import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TEST:U1:18 (AC:U1:10). Static guard over the root `CLAUDE.md`: it must not
 * name the retired `.qtm/` tracking system anywhere, and its billing smoke rule
 * must point to the checklist under `docs/billing/`.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const claudeMd = readFileSync(path.join(repoRoot, 'CLAUDE.md'), 'utf8');
const CHECKLIST = 'docs/billing/smoke-checklist.md';

/** Returns the body of the smoke-rule section (its heading up to the next `###`). */
function smokeRuleSection(source: string): string {
    const heading = /^### Billing testing.*smoke checklist.*$/im.exec(source);
    if (!heading) return '';
    const start = heading.index + heading[0].length;
    const next = source.slice(start).search(/^#{1,3} /m);
    return next === -1 ? source.slice(start) : source.slice(start, start + next);
}

describe('root CLAUDE.md smoke rule (TEST:U1:18)', () => {
    it('does not name the retired .qtm/ system anywhere', () => {
        expect(claudeMd).not.toContain('.qtm/');
    });

    it('has a smoke-rule section', () => {
        expect(smokeRuleSection(claudeMd).length).toBeGreaterThan(0);
    });

    it('points the smoke rule at the docs/billing checklist', () => {
        expect(smokeRuleSection(claudeMd)).toContain(CHECKLIST);
    });

    it('does not point the smoke rule at the retired SPEC-143 checklists', () => {
        expect(smokeRuleSection(claudeMd)).not.toMatch(
            /SPEC-143|staging-smoke-checklist|prod-smoke-checklist/
        );
    });
});
