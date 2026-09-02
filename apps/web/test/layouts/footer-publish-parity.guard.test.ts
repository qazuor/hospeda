/**
 * @file footer-publish-parity.guard.test.ts
 * @description HOS-826 — the footer's "Para vos" column must offer the same
 * commerce verticals the header's "Publicar" chooser does.
 *
 * ## Why parity, and not "the two links exist"
 *
 * The defect was not a missing anchor in isolation: the header has offered all
 * three verticals since HOS-691, and the footer stayed on one. What decays is
 * the AGREEMENT between the two surfaces, and it decays silently — rename
 * `publicar-experiencia` and the header follows (it reads
 * `PUBLISH_CTA_OPTIONS`) while the footer keeps a literal that now 404s, on
 * every page of the site, with nothing failing.
 *
 * So this reads the real constant the header renders from and requires each
 * commerce vertical's href to appear among the footer's `forYouLinks`. Renaming
 * a route in `discovery-doors.ts` fails here until the footer is updated too —
 * which is the property the literals in `Footer.astro` trade away and this
 * guard buys back.
 *
 * ## The accommodation option is deliberately excluded
 *
 * `PUBLISH_CTA_OPTIONS` has three entries; only two are checked. The footer's
 * pre-existing `footer.listProperty` link points at the owner's own landing —
 * `/planes/anfitriones/` since HOS-985, `/suscriptores/propietarios/` before
 * it — not at the chooser's `/publicar/`, and it predates the chooser by a long
 * way. Requiring parity on that entry would fail this guard on day one for a
 * link HOS-826 never asked anyone to move.
 *
 * @module test/layouts/footer-publish-parity.guard
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PUBLISH_CTA_OPTIONS } from '@/config/discovery-doors';

const footerSrc = readFileSync(resolve(__dirname, '../../src/layouts/Footer.astro'), 'utf8');

/**
 * The `forYouLinks` array literal, isolated from the rest of the file.
 *
 * Scoping the match matters: asserting a path appears "somewhere in
 * Footer.astro" would also pass if it appeared in the Explorar column, in a CSS
 * comment, or in this file's own docstring. The column is the claim.
 */
function readForYouBlock(src: string): string {
    const start = src.indexOf('const forYouLinks = [');
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf('] as const;', start);
    expect(end).toBeGreaterThan(start);
    return src.slice(start, end);
}

const forYouBlock = readForYouBlock(footerSrc);

/** The two commerce verticals — see the docstring for why `accommodation` is out. */
const COMMERCE_OPTION_IDS: ReadonlyArray<string> = ['gastronomy', 'experience'];

describe('HOS-826 — footer "Para vos" offers every commerce vertical', () => {
    it('the header chooser still exposes the options this guard reads', () => {
        // Non-vacuity: if PUBLISH_CTA_OPTIONS were emptied or its ids renamed,
        // every loop below would iterate zero times and report success.
        const ids = PUBLISH_CTA_OPTIONS.map((option) => option.id);
        expect(ids).toEqual(expect.arrayContaining([...COMMERCE_OPTION_IDS]));
        expect(PUBLISH_CTA_OPTIONS.length).toBeGreaterThanOrEqual(3);
    });

    for (const id of COMMERCE_OPTION_IDS) {
        it(`links the ${id} landing at the header's own destination`, () => {
            const option = PUBLISH_CTA_OPTIONS.find((candidate) => candidate.id === id);
            expect(option).toBeDefined();
            const href = option?.href ?? '';
            expect(href).not.toBe('');
            // `discovery-doors.ts` stores a bare segment (`publicar-experiencia`);
            // Footer.astro passes buildUrl a leading+trailing-slashed path.
            expect(forYouBlock).toContain(`"/${href}/"`);
        });
    }

    it('labels both new entries from i18n, never hard-coded text', () => {
        expect(forYouBlock).toContain('t("footer.listGastronomy")');
        expect(forYouBlock).toContain('t("footer.listExperience")');
    });

    it('leaves the pre-existing accommodation invitation off the chooser', () => {
        expect(forYouBlock).toContain('t("footer.listProperty")');
        // HOS-985 moved this link from `/suscriptores/propietarios/`, now
        // redirect-only, to the sales page that replaced it. What the guard
        // protects is unchanged: it must NOT point at `/publicar/`.
        expect(forYouBlock).toContain('"/planes/anfitriones/"');
    });
});
