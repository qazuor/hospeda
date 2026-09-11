/**
 * Guard: the key counts documented in `packages/billing/CLAUDE.md` must match
 * the enums they describe.
 *
 * The "Counts and files" table under "Entitlement & Limit Keys (SPEC-145)"
 * states how many members `EntitlementKey` and `LimitKey` have. Those numbers
 * were written once and nothing verified them afterwards, so they drifted in
 * BOTH directions — the doc claimed 38 entitlement keys against 39 real ones,
 * and 20 limit keys against 19. A count that looks authoritative and is wrong is
 * worse than no count: it is exactly the figure someone consults to answer "are
 * they all here?", and it answers wrongly with confidence.
 *
 * The runtime guards in `src/types/guards.ts` already avoid this class of drift
 * by building their look-up tables from `Object.values(...)` at module load. This
 * test extends the same idea to the documentation: the doc is checked against the
 * enum instead of being trusted.
 *
 * Adding or removing a key therefore fails here until the table is updated, which
 * is the point — the alternative is the doc quietly ageing another release.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EntitlementKey } from '../src/types/entitlement.types';
import { LimitKey } from '../src/types/plan.types';

const CLAUDE_MD_PATH = join(__dirname, '..', 'CLAUDE.md');

/**
 * Reads the documented count for one row of the "Counts and files" table.
 *
 * The row is anchored on the set name in backticks followed by the literal
 * `enum members` label, so a renamed or reordered table fails loudly rather than
 * matching some other row that happens to carry a number.
 */
const readDocumentedCount = ({
    doc,
    setName
}: {
    readonly doc: string;
    readonly setName: string;
}): number | null => {
    const row = new RegExp(`^\\|\\s*\`${setName}\` enum members\\s*\\|\\s*(\\d+)\\s*\\|`, 'm');
    const match = doc.match(row);
    return match?.[1] ? Number.parseInt(match[1], 10) : null;
};

describe('packages/billing/CLAUDE.md key counts', () => {
    const doc = readFileSync(CLAUDE_MD_PATH, 'utf-8');

    it.each([
        { setName: 'EntitlementKey', actual: Object.values(EntitlementKey).length },
        { setName: 'LimitKey', actual: Object.values(LimitKey).length }
    ])('documents the real number of $setName members', ({ setName, actual }) => {
        const documented = readDocumentedCount({ doc, setName });

        // A missing row must fail here rather than let the assertion below pass
        // vacuously on two nulls.
        expect(
            documented,
            `No "\`${setName}\` enum members" row found in the "Counts and files" table of packages/billing/CLAUDE.md. If the table was renamed or moved, update this guard along with it.`
        ).not.toBeNull();

        expect(
            documented,
            `packages/billing/CLAUDE.md says ${setName} has ${documented} members, but the enum has ${actual}. Update the "Counts and files" table.`
        ).toBe(actual);
    });
});
