/**
 * Regression suite for H-120 — "blocking dates does not remove the listing from
 * search results: the page never passes the dates to the API".
 *
 * The backend half was complete and verified against production before this
 * fix: `GET /public/accommodations?checkIn=2026-08-27&checkOut=2026-08-29`
 * returned 1 result instead of 2, and the blocked listing came back once the
 * dates moved to a free range. The listing page read the dates from the URL,
 * rendered "27/08" in the sidebar and "2 alojamientos" in the counter — with
 * both cards visible, including the one blocked on exactly those days.
 *
 * So the visitor was shown a filter being accepted and results that ignored it,
 * and the host was told blocking dates would hide the listing and it did not.
 *
 * This covers the both-or-neither rule that the three listing surfaces share.
 * The rule is not cosmetic: the model ignores a lone `checkIn` or `checkOut`
 * silently, so sending half a range is indistinguishable from sending none —
 * the same quiet discard the fix exists to remove.
 */

import { describe, expect, it } from 'vitest';
import { buildAvailabilityParams } from '../../src/lib/availability-params';

describe('H-120 — buildAvailabilityParams', () => {
    it('forwards a complete range', () => {
        // The exact range the smoke blocked in production.
        expect(buildAvailabilityParams({ checkIn: '2026-08-27', checkOut: '2026-08-29' })).toEqual({
            checkIn: '2026-08-27',
            checkOut: '2026-08-29'
        });
    });

    it('forwards a single-night stay', () => {
        expect(buildAvailabilityParams({ checkIn: '2026-08-27', checkOut: '2026-08-28' })).toEqual({
            checkIn: '2026-08-27',
            checkOut: '2026-08-28'
        });
    });

    it('sends nothing when only checkIn is present', () => {
        // The server would drop a lone date without saying so.
        expect(buildAvailabilityParams({ checkIn: '2026-08-27' })).toEqual({});
    });

    it('sends nothing when only checkOut is present', () => {
        expect(buildAvailabilityParams({ checkOut: '2026-08-29' })).toEqual({});
    });

    it('sends nothing when neither is present', () => {
        expect(buildAvailabilityParams({})).toEqual({});
        expect(buildAvailabilityParams({ checkIn: null, checkOut: null })).toEqual({});
    });

    it('sends nothing for an empty or whitespace value', () => {
        expect(buildAvailabilityParams({ checkIn: '', checkOut: '2026-08-29' })).toEqual({});
        expect(buildAvailabilityParams({ checkIn: '  ', checkOut: '2026-08-29' })).toEqual({});
    });

    it('sends nothing for a malformed date', () => {
        expect(buildAvailabilityParams({ checkIn: '27-08-2026', checkOut: '2026-08-29' })).toEqual(
            {}
        );
        expect(buildAvailabilityParams({ checkIn: '2026-08-27', checkOut: 'mañana' })).toEqual({});
    });

    it('sends nothing for an inverted range', () => {
        expect(buildAvailabilityParams({ checkIn: '2026-08-29', checkOut: '2026-08-27' })).toEqual(
            {}
        );
    });

    it('sends nothing for a zero-night range — the half-open window filters nothing', () => {
        expect(buildAvailabilityParams({ checkIn: '2026-08-27', checkOut: '2026-08-27' })).toEqual(
            {}
        );
    });

    it('trims surrounding whitespace before validating', () => {
        expect(
            buildAvailabilityParams({ checkIn: ' 2026-08-27 ', checkOut: ' 2026-08-29 ' })
        ).toEqual({ checkIn: '2026-08-27', checkOut: '2026-08-29' });
    });
});
