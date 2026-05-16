/**
 * Verifies the responsive table wrapper that fixes SPEC-135 F-021.
 *
 * The full DataTable component has a deep dependency tree that's awkward
 * to render in jsdom (see the comment at the top of
 * test/integration/accommodations.table.test.tsx). So this test does a
 * focused source-level assertion instead — it reads the source file and
 * asserts the responsive classes are present on the table and wrapper.
 *
 * Rationale: the fix IS a CSS class change; what we care about is that
 * the class never silently regresses. A snapshot/source assertion gives
 * exactly that guardrail without bringing the full table rendering
 * stack into the test harness.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DATATABLE_PATH = join(
    __dirname,
    '..',
    '..',
    '..',
    'src',
    'components',
    'table',
    'DataTable.tsx'
);

describe('DataTable — F-021 responsive scroll', () => {
    const source = readFileSync(DATATABLE_PATH, 'utf-8');

    it('wraps the table in an overflow-x scroll container', () => {
        expect(source).toContain('overflow-x-auto');
    });

    it('forces the table to its natural width below `lg` so columns overflow into horizontal scroll', () => {
        // `min-w-max` keeps the table at least as wide as its widest row;
        // `lg:min-w-0` releases that minimum at the desktop breakpoint so
        // the wider viewport renders the table flush again.
        expect(source).toMatch(/min-w-max[\s\S]+lg:min-w-0/);
    });
});
