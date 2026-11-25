/**
 * Tests for the two owner lists of `/mi-cuenta/comercio` (HOS-2559).
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { canAccessPublisherArea, publisherDenyRedirect } from '@/lib/account/publisher-access';
import {
    filterOwnerListingsByVertical,
    OWNER_LIST_LABEL_KEYS,
    ownerListPath,
    ownerListSectionKey,
    parseOwnerListVertical,
    resolveOwnerListPage,
    resolveOwnerListVerticals
} from '../../../src/lib/listing/owner-list-vertical';
import { buildUrl } from '../../../src/lib/urls';

const VENUE = [PermissionEnum.VENUE_EDIT_OWN];
const EXPERIENCE = [PermissionEnum.EXPERIENCE_EDIT_OWN];
const BOTH = [...VENUE, ...EXPERIENCE];

describe('ownerListPath / ownerListSectionKey', () => {
    it('builds one query-selected list per vertical', () => {
        expect(ownerListPath({ vertical: 'venue' })).toBe('mi-cuenta/comercio?vertical=venue');
        expect(ownerListPath({ vertical: 'experience' })).toBe(
            'mi-cuenta/comercio?vertical=experience'
        );
    });

    it('renders as a trailing-slash URL with the query after the slash', () => {
        expect(buildUrl({ locale: 'en', path: ownerListPath({ vertical: 'experience' }) })).toBe(
            '/en/mi-cuenta/comercio/?vertical=experience'
        );
    });

    it('gives each list its own activeSection key and label', () => {
        expect(ownerListSectionKey({ vertical: 'venue' })).toBe('comercio-venue');
        expect(ownerListSectionKey({ vertical: 'experience' })).toBe('comercio-experience');
        expect(OWNER_LIST_LABEL_KEYS).toEqual({
            venue: 'account.nav.myVenues',
            experience: 'account.nav.myExperiences'
        });
    });
});

describe('parseOwnerListVertical', () => {
    it.each([
        ['venue', 'venue'],
        ['experience', 'experience'],
        [null, null],
        ['', null],
        ['accommodation', null],
        ['VENUE', null]
    ] as const)('parses %j as %j', (value, expected) => {
        expect(parseOwnerListVertical({ value })).toBe(expected);
    });
});

describe('resolveOwnerListVerticals', () => {
    it('reads the vertical permissions, venues first', () => {
        expect(resolveOwnerListVerticals({ permissions: VENUE })).toEqual(['venue']);
        expect(resolveOwnerListVerticals({ permissions: EXPERIENCE })).toEqual(['experience']);
        expect(resolveOwnerListVerticals({ permissions: [...EXPERIENCE, ...VENUE] })).toEqual([
            'venue',
            'experience'
        ]);
    });

    it('grants nothing from unrelated permissions or a role name', () => {
        expect(
            resolveOwnerListVerticals({
                permissions: [PermissionEnum.ACCOMMODATION_CREATE, 'VENUE_OWNER']
            })
        ).toEqual([]);
    });
});

describe('resolveOwnerListPage', () => {
    it.each([
        ['es', '/es/mi-cuenta/'],
        ['en', '/en/mi-cuenta/'],
        ['pt', '/pt/mi-cuenta/']
    ] as const)('denied %s owner lists return to exact account home %s', (locale, expected) => {
        expect(resolveOwnerListPage({ requested: 'venue', permissions: [] }).kind).toBe(
            'forbidden'
        );
        expect(canAccessPublisherArea({ area: 'venue', permissions: [] })).toBe(false);
        expect(publisherDenyRedirect({ locale })).toBe(expected);
    });
    it('is forbidden with neither vertical', () => {
        expect(resolveOwnerListPage({ requested: 'venue', permissions: [] })).toEqual({
            kind: 'forbidden'
        });
    });

    it('renders the requested list when it is granted', () => {
        expect(resolveOwnerListPage({ requested: 'experience', permissions: BOTH })).toEqual({
            kind: 'render',
            vertical: 'experience'
        });
        expect(resolveOwnerListPage({ requested: 'venue', permissions: VENUE })).toEqual({
            kind: 'render',
            vertical: 'venue'
        });
    });

    it('redirects a URL with no list to the first granted one', () => {
        expect(resolveOwnerListPage({ requested: null, permissions: BOTH })).toEqual({
            kind: 'redirect',
            vertical: 'venue'
        });
        expect(resolveOwnerListPage({ requested: null, permissions: EXPERIENCE })).toEqual({
            kind: 'redirect',
            vertical: 'experience'
        });
    });

    it('redirects a list the person cannot open, or an unknown one, to the one they can', () => {
        expect(resolveOwnerListPage({ requested: 'venue', permissions: EXPERIENCE })).toEqual({
            kind: 'redirect',
            vertical: 'experience'
        });
        expect(resolveOwnerListPage({ requested: 'bogus', permissions: VENUE })).toEqual({
            kind: 'redirect',
            vertical: 'venue'
        });
    });
});

describe('filterOwnerListingsByVertical', () => {
    const listings = [
        { id: 'v1', vertical: 'venue' },
        { id: 'e1', vertical: 'experience' },
        { id: 'v2', vertical: 'venue' }
    ] as const;

    it('keeps only the listings of the list, in their order', () => {
        expect(
            filterOwnerListingsByVertical({ listings, vertical: 'venue' }).map((l) => l.id)
        ).toEqual(['v1', 'v2']);
        expect(
            filterOwnerListingsByVertical({ listings, vertical: 'experience' }).map((l) => l.id)
        ).toEqual(['e1']);
    });

    it('returns an empty list when the owner has none of that vertical', () => {
        expect(
            filterOwnerListingsByVertical({ listings: listings.slice(1, 2), vertical: 'venue' })
        ).toEqual([]);
    });
});
