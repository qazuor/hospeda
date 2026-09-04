/**
 * Every printed document asks for ITS OWN code (HOS-1129).
 *
 * ---
 * WHY THIS IS A STATIC GUARD AND NOT A ROUTE TEST
 *
 * `(entityType, entityId, purpose)` is the lookup key of `qr_codes`. Get the
 * `purpose` wrong at a call site and nothing anywhere fails: the route returns
 * 200, the PDF renders, the symbol scans — it just resolves to the OTHER
 * document's destination, on paper, permanently. Measured: flipping the
 * certificate route's `CERTIFICATE` to `BROCHURE` left all 17 tests covering
 * that route green.
 *
 * A behavioural test cannot see it either, because both purposes produce a
 * perfectly good code under the DB mock. What distinguishes right from wrong is
 * the pair itself, so the pair is what gets asserted — and an inventory rather
 * than three separate assertions, so that a FOURTH call site fails here until
 * somebody declares which code it is asking for.
 *
 * @module test/utils/entity-qr-purpose.guard
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_SRC = join(import.meta.dirname, '..', '..', 'src');

/** The helper whose every call site must be accounted for. */
const CALL = 'resolveEntityQrScanUrl(';

/**
 * Which code each document asks for, by the file that asks.
 *
 * An experience appears TWICE on purpose: its brochure and its certificate are
 * two live codes for one subject, landing in different places, and `purpose` is
 * the only thing that tells them apart.
 */
const EXPECTED: Readonly<Record<string, { entityType: string; purpose: string }>> = {
    'routes/gastronomy/protected/brochure.ts': {
        entityType: 'GASTRONOMY',
        purpose: 'BROCHURE'
    },
    'routes/experience/protected/brochure.ts': {
        entityType: 'EXPERIENCE',
        purpose: 'BROCHURE'
    },
    'routes/experience/protected/certificates.ts': {
        entityType: 'EXPERIENCE',
        purpose: 'CERTIFICATE'
    }
};

/** Every `.ts` file under `apps/api/src`, as paths relative to it. */
function sourceFiles(dir = API_SRC, prefix = ''): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const rel = prefix ? `${prefix}/${entry}` : entry;
        if (statSync(full).isDirectory()) {
            out.push(...sourceFiles(full, rel));
        } else if (entry.endsWith('.ts')) {
            out.push(rel);
        }
    }
    return out;
}

/** The argument object of the first `resolveEntityQrScanUrl(` call in `source`. */
function callArguments(source: string): string {
    const start = source.indexOf(CALL);
    if (start === -1) {
        throw new Error(`no ${CALL} call found`);
    }
    const end = source.indexOf('});', start);
    if (end === -1) {
        throw new Error(`unterminated ${CALL} call`);
    }
    return source.slice(start, end);
}

describe('which QR each printed document asks for (HOS-1129)', () => {
    const callers = sourceFiles().filter(
        (file) =>
            file !== 'utils/entity-qr.ts' &&
            readFileSync(join(API_SRC, file), 'utf8').includes(CALL)
    );

    it('has exactly the call sites this file accounts for', () => {
        // A zero here would make every assertion below vacuous, and a NEW entry
        // is the case this guard exists for: a document that prints a code
        // without saying which code it is asking for.
        expect(callers.length).toBeGreaterThan(0);
        expect([...callers].sort()).toStrictEqual(Object.keys(EXPECTED).sort());
    });

    for (const [file, expected] of Object.entries(EXPECTED)) {
        it(`${file} asks for ${expected.entityType}/${expected.purpose}`, () => {
            const args = callArguments(readFileSync(join(API_SRC, file), 'utf8'));

            expect(args).toContain(`entityType: EntityTypeEnum.${expected.entityType}`);
            expect(args).toContain(`purpose: QrCodePurposeEnum.${expected.purpose}`);
        });
    }
});
