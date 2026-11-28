/**
 * HOS-2679 — the QR UTM editor's pure core.
 *
 * Asserted on exact URL strings: the editor promises to touch only what the
 * operator changed, so a rewrite that re-encodes an untouched value is a bug
 * even when every UTM reads back right.
 */
import { describe, expect, it } from 'vitest';
import { applyUtmEdit, readUtmParams, toUtmEditDraft } from '../src/index.js';

const EMPTY = { utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '' };
const NONE = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null
};
const LANDING = { ...NONE, utm_source: 'qr', utm_medium: 'print', utm_campaign: 'manual' };

describe('toUtmEditDraft', () => {
    it('opens with the stored values when the URL carries any UTM', () => {
        const start = toUtmEditDraft({
            url: 'https://h.test/?utm_campaign=verano+2026',
            landing: { ...NONE, utm_campaign: 'verano 2026' }
        });
        expect(start).toStrictEqual({
            draft: { ...EMPTY, utm_campaign: 'verano 2026' },
            seededFromLanding: false
        });
    });

    /** I1: the redirect's automatic UTMs must not vanish on the first edit. */
    it('seeds from the landing when the stored URL has no UTM', () => {
        const start = toUtmEditDraft({ url: 'https://h.test/es/', landing: LANDING });
        expect(start).toStrictEqual({
            draft: { ...EMPTY, utm_source: 'qr', utm_medium: 'print', utm_campaign: 'manual' },
            seededFromLanding: true
        });
    });

    it('opens empty for an undecorated URL with no UTM (an external target)', () => {
        const start = toUtmEditDraft({ url: 'https://instagram.com/x', landing: NONE });
        expect(start).toStrictEqual({ draft: EMPTY, seededFromLanding: false });
    });
});

describe('applyUtmEdit', () => {
    it('answers null when nothing was edited, seeded or not', () => {
        const url = 'https://h.test/es/';
        const { draft } = toUtmEditDraft({ url, landing: LANDING });
        expect(applyUtmEdit({ url, initial: draft, draft })).toBeNull();
    });

    it('writes the full seeded set on the first edit', () => {
        const url = 'https://h.test/es/?ref=a#mapa';
        const { draft: initial } = toUtmEditDraft({ url, landing: LANDING });
        const next = applyUtmEdit({
            url,
            initial,
            draft: { ...initial, utm_campaign: 'verano' }
        });
        expect(next).toBe(
            'https://h.test/es/?ref=a&utm_source=qr&utm_medium=print&utm_campaign=verano#mapa'
        );
    });

    /** N4: an untouched `a+b` stays `a+b`, not `a%20b`. */
    it('patches only the keys that changed', () => {
        const url = 'https://h.test/?utm_source=a+b&utm_campaign=x';
        const { draft: initial } = toUtmEditDraft({ url });
        const next = applyUtmEdit({ url, initial, draft: { ...initial, utm_campaign: 'y' } });
        expect(next).toBe('https://h.test/?utm_source=a+b&utm_campaign=y');
    });

    it('ignores whitespace-only differences and removes a cleared key', () => {
        const url = 'https://h.test/?utm_source=flyer&utm_term=t';
        const { draft: initial } = toUtmEditDraft({ url });
        expect(
            applyUtmEdit({ url, initial, draft: { ...initial, utm_source: ' flyer ' } })
        ).toBeNull();
        expect(applyUtmEdit({ url, initial, draft: { ...initial, utm_term: '' } })).toBe(
            'https://h.test/?utm_source=flyer'
        );
    });

    it('round-trips through readUtmParams', () => {
        const url = 'https://h.test/';
        const { draft: initial } = toUtmEditDraft({ url });
        const next = applyUtmEdit({
            url,
            initial,
            draft: { ...initial, utm_campaign: 'año & más' }
        }) as string;
        expect(readUtmParams({ url: next }).utm_campaign).toBe('año & más');
    });
});
