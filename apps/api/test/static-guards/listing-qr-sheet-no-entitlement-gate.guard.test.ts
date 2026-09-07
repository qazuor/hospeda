/**
 * @file listing-qr-sheet-no-entitlement-gate.guard.test.ts
 * @description Freezes the owner decision that a listing's QR is UNGATED, in
 * all three verticals and on both surfaces that hand it over (HOS-982): the
 * printable sheet (`qrSheet.ts`) and the dashboard image (`qrCode.ts`, PR 2).
 *
 * The six routes sit beside two documents that ARE gated — the brochure
 * (`DOWNLOAD_LISTING_PDF`) and the gastronomy menu writes
 * (`MANAGE_GASTRONOMY_MENU`) — and they were written by copying those files.
 * The obvious "consistency" fix is to add `requireEntitlement` here too, and it
 * would look like tidying rather than like a product change: nothing else in the
 * suite would go red, because a gated route that refuses an unentitled caller is
 * a perfectly correct route.
 *
 * It is not tidying. The decision (2026-09-07) is that a QR taped to a door
 * brings people to the platform, so restricting it costs US and not the
 * subscriber. Reversing it is a conversation with the owner, and this guard is
 * what turns that reversal from a silent diff into a red test.
 *
 * ## Why static, and what it can actually see
 *
 * The absence of a middleware is not observable from a passing request: an
 * entitled caller gets the file either way, and the seeded fixtures are entitled.
 * Proving the negative behaviourally would mean standing up billing and an
 * unentitled subscriber for each of three verticals to assert six 200s — a lot
 * of machinery to assert that nothing happened.
 *
 * The predicate is the SOURCE TEXT of one file per vertical per surface. Its limit, said out
 * loud: a gate added through a helper that spells neither `requireEntitlement`
 * nor `EntitlementKey` walks past this. The counter-assertion below is what
 * keeps the check honest — it proves both tokens are still the spelling the
 * codebase uses, by finding them in the brochure route that genuinely is gated.
 * If the brochure ever stops matching, this guard has gone vacuous and says so
 * rather than passing.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES = join(__dirname, '../../src/routes');

/**
 * Every route that hands an owner their listing code, by vertical and surface.
 *
 * Six since HOS-982 PR 2, not three: `qrCode.ts` returns the SAME code as its
 * `qrSheet.ts` twin, as SVG, so the owner can see on screen what the printed
 * page will carry. Gating one half of a pair would be worse than gating both —
 * the panel would show a code the sheet then refused to print, or the reverse —
 * so the decision is frozen across the pair rather than per file.
 */
const SHEET_ROUTES: readonly {
    readonly vertical: string;
    readonly surface: string;
    readonly path: string;
}[] = [
    {
        vertical: 'accommodation',
        surface: 'sheet',
        path: join(ROUTES, 'accommodation/protected/qrSheet.ts')
    },
    {
        vertical: 'gastronomy',
        surface: 'sheet',
        path: join(ROUTES, 'gastronomy/protected/qrSheet.ts')
    },
    {
        vertical: 'experience',
        surface: 'sheet',
        path: join(ROUTES, 'experience/protected/qrSheet.ts')
    },
    {
        vertical: 'accommodation',
        surface: 'image',
        path: join(ROUTES, 'accommodation/protected/qrCode.ts')
    },
    {
        vertical: 'gastronomy',
        surface: 'image',
        path: join(ROUTES, 'gastronomy/protected/qrCode.ts')
    },
    {
        vertical: 'experience',
        surface: 'image',
        path: join(ROUTES, 'experience/protected/qrCode.ts')
    }
];

/** A route that IS entitlement-gated, so the tokens can be proven to be live. */
const GATED_REFERENCE = join(ROUTES, 'gastronomy/protected/brochure.ts');

function read(path: string): string {
    return readFileSync(path, 'utf-8');
}

/**
 * The file with its comments removed.
 *
 * Load-bearing, not tidiness: the accommodation route's docblock spells
 * `requireEntitlement` in a sentence telling the next reader NOT to add one, and
 * a guard that read the prose would fail on the very comment that explains it.
 * The predicate is about CODE.
 *
 * Line comments are only stripped when they START a line (after whitespace), so
 * a `//` inside a URL literal survives.
 */
function readCode(path: string): string {
    return read(path)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('the listing QR is ungated, on both surfaces of all three verticals (HOS-982)', () => {
    it('has a route file per vertical per surface — a missing one would pass every check below', () => {
        for (const route of SHEET_ROUTES) {
            expect(
                read(route.path).length,
                `${route.vertical} ${route.surface} route is empty`
            ).toBeGreaterThan(500);
        }
    });

    it.each(SHEET_ROUTES)('$vertical $surface: declares no entitlement gate', ({ path }) => {
        const source = readCode(path);
        expect(source).not.toContain('requireEntitlement');
        expect(source).not.toContain('EntitlementKey');
    });

    it('is not vacuous: both tokens are still what a gated route is written with', () => {
        // If this fails, the two assertions above stopped being able to detect
        // anything and the guard needs re-anchoring — it has NOT "kept passing".
        const gated = readCode(GATED_REFERENCE);
        expect(gated).toContain('requireEntitlement');
        expect(gated).toContain('EntitlementKey');
    });

    it.each(SHEET_ROUTES)('$vertical $surface: still refuses a listing that is not PUBLIC', ({
        path
    }) => {
        // The gate that DOES survive: no public ficha, no code. Asserted here so
        // that "ungated" can never be read as "unchecked".
        const source = readCode(path);
        expect(source).toContain('VisibilityEnum.PUBLIC');
        expect(source).toContain('entityNotFoundError');
    });

    it.each(SHEET_ROUTES)('$vertical $surface: also refuses a listing that is not ACTIVE', ({
        path
    }) => {
        // BOTH halves of "published", in all three verticals. The commerce two
        // checked visibility alone until this was found: their services answer
        // NOT_FOUND to every non-owner on a non-ACTIVE row, so a listing PATCHed
        // to INACTIVE with PUBLIC visibility left standing would have minted a
        // code and been printed — and every scan of that paper 404s forever.
        //
        // Static as well as behavioural (`test/routes/listing-qr-sheet.test.ts`
        // exercises the branch) because the failure mode is a clause being
        // DROPPED while every other assertion about the route stays green.
        const source = readCode(path);
        expect(source).toContain('LifecycleStatusEnum.ACTIVE');
    });

    it.each(SHEET_ROUTES)('$vertical $surface: mints through the central QR point', ({ path }) => {
        const source = readCode(path);
        // `resolveEntityQrScanUrl` is the ONE authorised way to turn an entity
        // plus a purpose into a printable code; `LISTING` is what keeps this
        // sheet's row distinct from the brochure's, the certificate's and the
        // menu's on the very same subject.
        expect(source).toContain('resolveEntityQrScanUrl');
        expect(source).toContain('QrCodePurposeEnum.LISTING');
        // And never the raw encoder package: a code drawn straight out of it
        // encodes a final URL, which can never be repointed once printed.
        //
        // Written as a regex rather than as a quoted literal on purpose. The
        // repo-wide guard (`scripts/check-qrcode-engine-isolation.sh`) greps for
        // the import SPELLING, so a test file containing that spelling inside a
        // string — even to forbid it — is itself a violation. Measured: it was,
        // and this suite failed that script until the literal came out.
        expect(source).not.toMatch(/from\s+['"`]qrcode/);
    });
});
