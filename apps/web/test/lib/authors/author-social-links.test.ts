/**
 * @file author-social-links.test.ts
 * @description Unit tests for `resolveAuthorSocialLinks` (HOS-375 §6.7 / §8).
 *
 * The interesting property is not "it maps an object to a list" — it is which
 * stored values are refused. The column holds shapes the write-side regex would
 * reject (bare handles, mobile variants), because the public read path uses the
 * LENIENT schema on purpose; a bare handle rendered as an `href` ships a link
 * that resolves against the current path.
 */

import { describe, expect, it } from 'vitest';
import { resolveAuthorSocialLinks } from '../../../src/lib/authors/author-social-links';

describe('resolveAuthorSocialLinks — opt-in gate', () => {
    it('returns nothing when the payload omitted the object', () => {
        // The API omits `socialNetworks` entirely unless the OWNER opted in, so
        // absence IS the opt-out. Returning links here would publish data the
        // author never agreed to publish.
        expect(resolveAuthorSocialLinks({ socialNetworks: undefined })).toEqual([]);
    });

    it('returns nothing for an explicit null', () => {
        expect(resolveAuthorSocialLinks({ socialNetworks: null })).toEqual([]);
    });

    it('returns nothing for an opted-in author who stored no networks', () => {
        expect(resolveAuthorSocialLinks({ socialNetworks: {} })).toEqual([]);
    });
});

describe('resolveAuthorSocialLinks — only linkable values', () => {
    it('keeps an absolute https URL', () => {
        const links = resolveAuthorSocialLinks({
            socialNetworks: { instagram: 'https://instagram.com/carmen' }
        });

        expect(links).toEqual([
            { key: 'instagram', label: 'Instagram', url: 'https://instagram.com/carmen' }
        ]);
    });

    it('keeps a plain http URL', () => {
        const links = resolveAuthorSocialLinks({
            socialNetworks: { facebook: 'http://facebook.com/carmen' }
        });

        expect(links).toHaveLength(1);
    });

    it.each([
        ['a bare handle — would resolve against the current path', '@carmen'],
        ['a host with no scheme', 'instagram.com/carmen'],
        ['a protocol-relative URL', '//instagram.com/carmen'],
        ['the empty string', ''],
        ['whitespace only', '   '],
        ['a javascript: URL', 'javascript:alert(1)']
    ])('drops %s', (_label, value) => {
        expect(resolveAuthorSocialLinks({ socialNetworks: { instagram: value } })).toEqual([]);
    });

    it('trims a padded URL rather than dropping it', () => {
        const links = resolveAuthorSocialLinks({
            socialNetworks: { youtube: '  https://youtube.com/@carmen  ' }
        });

        expect(links[0]?.url).toBe('https://youtube.com/@carmen');
    });

    it('keeps the linkable networks and drops the rest of the SAME payload', () => {
        // Non-vacuity: the filter is per entry, not all-or-nothing.
        const links = resolveAuthorSocialLinks({
            socialNetworks: {
                instagram: 'https://instagram.com/carmen',
                facebook: '@carmen',
                youtube: 'https://youtube.com/@carmen'
            }
        });

        expect(links.map((link) => link.key)).toEqual(['instagram', 'youtube']);
    });
});

describe('resolveAuthorSocialLinks — display order', () => {
    it('emits networks in the declared order, not the object key order', () => {
        const links = resolveAuthorSocialLinks({
            socialNetworks: {
                tiktok: 'https://tiktok.com/@carmen',
                instagram: 'https://instagram.com/carmen',
                linkedIn: 'https://linkedin.com/in/carmen'
            }
        });

        expect(links.map((link) => link.key)).toEqual(['instagram', 'linkedIn', 'tiktok']);
    });

    it('labels twitter as X — the brand it links to today', () => {
        const links = resolveAuthorSocialLinks({
            socialNetworks: { twitter: 'https://x.com/carmen' }
        });

        expect(links[0]?.label).toBe('X');
    });
});

describe('resolveAuthorSocialLinks — scheme allow-list', () => {
    it.each([
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        '\u0001javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)'
    ])('drops a stored profile whose scheme is %j', (instagram) => {
        // HOS-592 / F-02: this used to be a local `^https?://` regex. It is the
        // shared allow-list now, so this file cannot drift away from the one
        // place the rule lives — and the leading-control-character variant,
        // which an HTML parser strips before reading the scheme, is refused too.
        expect(resolveAuthorSocialLinks({ socialNetworks: { instagram } })).toEqual([]);
    });

    it('still publishes an ordinary https profile', () => {
        expect(
            resolveAuthorSocialLinks({ socialNetworks: { instagram: 'https://instagram.com/c' } })
        ).toEqual([{ key: 'instagram', label: 'Instagram', url: 'https://instagram.com/c' }]);
    });
});
