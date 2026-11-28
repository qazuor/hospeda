/**
 * HOS-2679 — reading and rewriting the `utm_*` params of a manual QR target.
 *
 * Every rewrite assertion compares the WHOLE output string with `toBe`, never a
 * parsed `URLSearchParams`: the property under test is that the bytes the
 * operator did not touch come out identical, and a parsed comparison is blind to
 * a re-encoded neighbour.
 */
import { describe, expect, it } from 'vitest';
import { readUtmParams, rewriteUtmParams, UTM_PARAM_KEYS } from '../src/index.js';

const NONE = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null
} as const;

describe('UTM_PARAM_KEYS', () => {
    it('pins the five keys in append order', () => {
        expect(UTM_PARAM_KEYS).toEqual([
            'utm_source',
            'utm_medium',
            'utm_campaign',
            'utm_content',
            'utm_term'
        ]);
    });
});

describe('readUtmParams', () => {
    it('answers null for every key on a URL without a query', () => {
        expect(readUtmParams({ url: 'https://hospeda.com.ar/es/' })).toEqual(NONE);
    });

    it('answers null for every key on a bare `?`', () => {
        expect(readUtmParams({ url: 'https://hospeda.com.ar/es/?' })).toEqual(NONE);
    });

    it('reads all five keys and ignores other params', () => {
        // Arrange
        const url =
            'https://hospeda.com.ar/es/?ref=x&utm_source=flyer&utm_medium=print&utm_campaign=verano&utm_content=a&utm_term=b';

        // Act
        const values = readUtmParams({ url });

        // Assert
        expect(values).toEqual({
            utm_source: 'flyer',
            utm_medium: 'print',
            utm_campaign: 'verano',
            utm_content: 'a',
            utm_term: 'b'
        });
    });

    it('decodes percent-escapes and `+` as a space', () => {
        const values = readUtmParams({
            url: 'https://x.test/?utm_campaign=verano%202026&utm_content=uno+dos&utm_term=%C3%B1'
        });
        expect(values.utm_campaign).toBe('verano 2026');
        expect(values.utm_content).toBe('uno dos');
        expect(values.utm_term).toBe('ñ');
    });

    it('returns a malformed escape raw instead of throwing', () => {
        expect(readUtmParams({ url: 'https://x.test/?utm_campaign=100%' }).utm_campaign).toBe(
            '100%'
        );
    });

    it('takes the FIRST occurrence of a duplicate key', () => {
        expect(
            readUtmParams({ url: 'https://x.test/?utm_campaign=a&utm_campaign=b' }).utm_campaign
        ).toBe('a');
    });

    it('matches keys case-insensitively', () => {
        expect(readUtmParams({ url: 'https://x.test/?UTM_Source=flyer' }).utm_source).toBe('flyer');
    });

    it('does not read the fragment as query', () => {
        expect(readUtmParams({ url: 'https://x.test/#utm_campaign=x' })).toEqual(NONE);
    });

    it('reads a bare key as an empty string', () => {
        expect(readUtmParams({ url: 'https://x.test/?utm_term' }).utm_term).toBe('');
    });

    it('works on a base-relative URL', () => {
        expect(readUtmParams({ url: '/es/?utm_medium=print' }).utm_medium).toBe('print');
    });
});

describe('rewriteUtmParams', () => {
    it('adds a query to a URL that had none', () => {
        expect(
            rewriteUtmParams({
                url: 'https://hospeda.com.ar/es/',
                utm: { utm_campaign: 'verano' }
            })
        ).toBe('https://hospeda.com.ar/es/?utm_campaign=verano');
    });

    it('replaces an existing key IN PLACE and leaves the neighbours byte-identical', () => {
        // Arrange — `%20`, `~` and `a=b=c` are exactly what URLSearchParams would re-encode.
        const url = 'https://x.test/p?q=a%20b&utm_campaign=old&t=~x&k=b=c';

        // Act
        const out = rewriteUtmParams({ url, utm: { utm_campaign: 'nueva' } });

        // Assert
        expect(out).toBe('https://x.test/p?q=a%20b&utm_campaign=nueva&t=~x&k=b=c');
    });

    it('appends missing keys after the existing params, in canonical order', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/?ref=1',
                utm: { utm_term: 't', utm_source: 's', utm_medium: 'm' }
            })
        ).toBe('https://x.test/?ref=1&utm_source=s&utm_medium=m&utm_term=t');
    });

    it('preserves the hash', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/p?a=1#section-2',
                utm: { utm_source: 'flyer' }
            })
        ).toBe('https://x.test/p?a=1&utm_source=flyer#section-2');
    });

    it('preserves the hash on a URL with no query', () => {
        expect(
            rewriteUtmParams({ url: 'https://x.test/p#top', utm: { utm_source: 'flyer' } })
        ).toBe('https://x.test/p?utm_source=flyer#top');
    });

    it('removes a key given an empty value', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/?a=1&utm_campaign=old&b=2',
                utm: { utm_campaign: '' }
            })
        ).toBe('https://x.test/?a=1&b=2');
    });

    it('removes a key given null or whitespace', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/?utm_source=s&utm_medium=m&z=1',
                utm: { utm_source: null, utm_medium: '   ' }
            })
        ).toBe('https://x.test/?z=1');
    });

    it('drops the `?` when the last param is removed, keeping the hash', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/p?utm_campaign=old#h',
                utm: { utm_campaign: null }
            })
        ).toBe('https://x.test/p#h');
    });

    it('leaves keys absent from the patch untouched, encoding and all', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/?utm_source=a+b&utm_campaign=x',
                utm: { utm_campaign: 'y' }
            })
        ).toBe('https://x.test/?utm_source=a+b&utm_campaign=y');
    });

    it('collapses duplicates of a rewritten key into the first position', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/?utm_campaign=a&x=1&utm_campaign=b',
                utm: { utm_campaign: 'c' }
            })
        ).toBe('https://x.test/?utm_campaign=c&x=1');
    });

    it('removes every duplicate when the key is cleared', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/?utm_campaign=a&x=1&utm_campaign=b',
                utm: { utm_campaign: '' }
            })
        ).toBe('https://x.test/?x=1');
    });

    it('keeps duplicates of a key that is NOT being rewritten', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/?utm_term=a&utm_term=b',
                utm: { utm_source: 's' }
            })
        ).toBe('https://x.test/?utm_term=a&utm_term=b&utm_source=s');
    });

    it('encodes the written value', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/',
                utm: { utm_campaign: 'verano 2026 & más' }
            })
        ).toBe('https://x.test/?utm_campaign=verano%202026%20%26%20m%C3%A1s');
    });

    it('trims the written value', () => {
        expect(
            rewriteUtmParams({ url: 'https://x.test/', utm: { utm_campaign: '  verano ' } })
        ).toBe('https://x.test/?utm_campaign=verano');
    });

    it('rewrites a mixed-case key in lower case, in place', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/?a=1&UTM_Campaign=old&b=2',
                utm: { utm_campaign: 'new' }
            })
        ).toBe('https://x.test/?a=1&utm_campaign=new&b=2');
    });

    it('returns the URL untouched for an empty patch', () => {
        const url = 'https://x.test/?a=%7E&b';
        expect(rewriteUtmParams({ url, utm: {} })).toBe(url);
    });

    it('does not treat a lookalike key as a UTM param', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/?utm_campaigns=keep&xutm_source=keep',
                utm: { utm_campaign: 'c', utm_source: 's' }
            })
        ).toBe('https://x.test/?utm_campaigns=keep&xutm_source=keep&utm_source=s&utm_campaign=c');
    });

    it('round-trips: what it writes, readUtmParams reads back', () => {
        // Arrange
        const utm = {
            utm_source: 'flyer',
            utm_medium: 'print',
            utm_campaign: 'verano 2026 / ñandú',
            utm_content: 'a+b',
            utm_term: '100%'
        };

        // Act
        const url = rewriteUtmParams({ url: 'https://x.test/?ref=1#x', utm });

        // Assert
        expect(readUtmParams({ url })).toEqual(utm);
    });

    it('does not touch the path even when it contains utm-looking text', () => {
        expect(
            rewriteUtmParams({
                url: 'https://x.test/utm_source=path/?a=1',
                utm: { utm_source: 's' }
            })
        ).toBe('https://x.test/utm_source=path/?a=1&utm_source=s');
    });
});
