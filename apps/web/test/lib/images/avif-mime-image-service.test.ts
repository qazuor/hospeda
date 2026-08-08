/**
 * @file avif-mime-image-service.test.ts
 * @description Tests for the AVIF `Content-Type` correction (HOS-369).
 *
 * The rewrite has to be narrow: it fixes AVIF and must not touch anything else,
 * because `format` is what Astro's image endpoint turns into the response
 * `Content-Type` for EVERY image on the site, not just the hero. A rule that
 * over-matched would mislabel real HEIF/HEIC passthroughs, and the fallback path
 * where sharp bails and returns the untouched input buffer in its source format.
 */

import { describe, expect, it } from 'vitest';
import { resolveOutputFormat } from '@/lib/images/avif-mime-image-service';

describe('resolveOutputFormat', () => {
    it("rewrites sharp's 'heif' to 'avif' when AVIF was requested", () => {
        expect(
            resolveOutputFormat({ requestedFormat: 'avif', reportedFormat: 'heif' }),
            "Sharp reports AVIF output as 'heif' because AVIF rides in a HEIF container. " +
                'Astro passes that straight into mime.lookup(), so the endpoint answered ' +
                '`Content-Type: image/heif` for every AVIF variant.'
        ).toBe('avif');
    });

    it('leaves a genuine HEIF passthrough alone', () => {
        expect(
            resolveOutputFormat({ requestedFormat: 'heif', reportedFormat: 'heif' }),
            'Only a request for AVIF may be relabelled. A real HEIF must keep its own type.'
        ).toBe('heif');
    });

    it('leaves the sharp-bailed fallback alone', () => {
        // When sharp cannot encode, the service returns the input buffer with
        // the SOURCE format, while `f=avif` was still requested. Relabelling
        // that would advertise a JPEG as AVIF.
        expect(resolveOutputFormat({ requestedFormat: 'avif', reportedFormat: 'jpeg' })).toBe(
            'jpeg'
        );
        expect(resolveOutputFormat({ requestedFormat: 'avif', reportedFormat: 'png' })).toBe('png');
    });

    it.each([
        ['webp', 'webp'],
        ['png', 'png'],
        ['jpeg', 'jpeg'],
        ['gif', 'gif'],
        ['svg', 'svg'],
        ['heic', 'heic']
    ])('passes %s through untouched', (requested, reported) => {
        expect(resolveOutputFormat({ requestedFormat: requested, reportedFormat: reported })).toBe(
            reported
        );
    });

    it('passes through when no format was requested (source format kept)', () => {
        expect(resolveOutputFormat({ requestedFormat: undefined, reportedFormat: 'jpeg' })).toBe(
            'jpeg'
        );
        expect(
            resolveOutputFormat({ requestedFormat: undefined, reportedFormat: 'heif' }),
            'Without an explicit AVIF request there is nothing to correct — the source really ' +
                'was HEIF.'
        ).toBe('heif');
    });
});
