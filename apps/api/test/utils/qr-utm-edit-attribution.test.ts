/**
 * HOS-2679 I1 — editing ONE UTM of a MANUAL code must not switch off its QR
 * attribution.
 *
 * End to end across the two halves that used to disagree: the panel's editor
 * (`toUtmEditDraft` / `applyUtmEdit`, from `@repo/analytics`) writes a new
 * `targetUrl`, and the redirect (`buildQrRedirectTarget`) decides what a scan
 * lands with. `withUtm` never mixes — a URL with ANY `utm_*` is left untouched —
 * so an editor that wrote only `utm_campaign` dropped `source=qr` and
 * `medium=print` from every later scan.
 */
import { applyUtmEdit, readUtmParams, toUtmEditDraft } from '@repo/analytics';
import { describe, expect, it } from 'vitest';
import { buildQrRedirectTarget } from '../../src/utils/qr-attribution';

const SITE = 'https://hospeda.com.ar';

/** What a scan of a MANUAL code (no entity, no purpose) lands with. */
const landingOf = (targetUrl: string) =>
    readUtmParams({
        url: buildQrRedirectTarget({
            targetUrl,
            entityType: null,
            purpose: null,
            siteUrl: SITE
        })
    });

describe('QR UTM editor → redirect (HOS-2679 I1)', () => {
    it('keeps source and medium after editing only the campaign', () => {
        // Arrange: an own-site code with no UTM of its own, as the list shows it.
        const stored = 'https://hospeda.com.ar/es/destinos/colon/?ref=a#mapa';
        const landing = landingOf(stored);
        const { draft: initial, seededFromLanding } = toUtmEditDraft({ url: stored, landing });

        // Act: the operator changes the campaign and saves.
        const saved = applyUtmEdit({
            url: stored,
            initial,
            draft: { ...initial, utm_campaign: 'verano' }
        });

        // Assert
        expect(seededFromLanding).toBe(true);
        expect(saved).not.toBeNull();
        expect(landingOf(saved as string)).toStrictEqual({
            utm_source: 'qr',
            utm_medium: 'print',
            utm_campaign: 'verano',
            utm_content: null,
            utm_term: null
        });
    });

    /** Non-vacuity: the defect this guards, reproduced without the seeding. */
    it('loses them when the editor starts from the stored (empty) values', () => {
        const stored = 'https://hospeda.com.ar/es/destinos/colon/';
        const { draft: initial } = toUtmEditDraft({ url: stored });

        const saved = applyUtmEdit({
            url: stored,
            initial,
            draft: { ...initial, utm_campaign: 'verano' }
        }) as string;

        expect(landingOf(saved).utm_source).toBeNull();
        expect(landingOf(saved).utm_medium).toBeNull();
    });

    it('never seeds an external target, which the redirect does not decorate', () => {
        const stored = 'https://instagram.com/hospeda';
        const { draft, seededFromLanding } = toUtmEditDraft({
            url: stored,
            landing: landingOf(stored)
        });

        expect(seededFromLanding).toBe(false);
        expect(draft.utm_source).toBe('');
    });
});
