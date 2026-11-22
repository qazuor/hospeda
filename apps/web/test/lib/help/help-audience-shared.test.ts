/**
 * HOS-2552 — the breadcrumb audience and the `?para=` the help links carry.
 * URL-driven only, so the article page stays session-blind (D-H4).
 */

import { describe, expect, it } from 'vitest';
import {
    helpCrumbAudience,
    withHelpAudienceParam
} from '../../../src/lib/help/help-audience-shared';

describe('helpCrumbAudience', () => {
    it('shows the tab the reader came from when the article is for it', () => {
        expect(
            helpCrumbAudience({ para: 'host', audiences: ['host', 'venue', 'experience'] })
        ).toBe('host');
    });

    it('shows no audience level without ?para=, never the first audience', () => {
        expect(
            helpCrumbAudience({ para: undefined, audiences: ['experience', 'host'] })
        ).toBeUndefined();
    });

    it('shows no audience level when ?para= names an audience the article is not for', () => {
        expect(helpCrumbAudience({ para: 'partner', audiences: ['host'] })).toBeUndefined();
    });
});

describe('withHelpAudienceParam', () => {
    it('adds ?para= when the target is written for the audience', () => {
        expect(
            withHelpAudienceParam({
                href: '/es/mi-cuenta/ayuda/photos/',
                audience: 'venue',
                audiences: ['host', 'venue']
            })
        ).toBe('/es/mi-cuenta/ayuda/photos/?para=venue');
    });

    it('keeps a #anchor after the query', () => {
        expect(
            withHelpAudienceParam({
                href: '/es/mi-cuenta/ayuda/photos/#tope-de-fotos',
                audience: 'host',
                audiences: ['host']
            })
        ).toBe('/es/mi-cuenta/ayuda/photos/?para=host#tope-de-fotos');
    });

    it("leaves the href alone when the audience is unknown or not the target's", () => {
        const href = '/es/mi-cuenta/ayuda/photos/';
        expect(withHelpAudienceParam({ href, audience: undefined, audiences: ['host'] })).toBe(
            href
        );
        expect(withHelpAudienceParam({ href, audience: 'partner', audiences: ['host'] })).toBe(
            href
        );
    });
});
