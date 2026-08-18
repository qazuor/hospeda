/**
 * Guard: a permission family may not be spelled two different ways.
 *
 * ## The trap
 *
 * `PermissionEnum` mixes two conventions for what is one domain. The event
 * organizer family is the case that bit during the August 2026 smoke:
 *
 *   EVENT_ORGANIZER_MANAGE = 'event.organizer.manage'   ← dotted, lower-case
 *   EVENT_ORGANIZER_CREATE = 'eventOrganizer.create'    ← camelCase prefix
 *   ...and six more siblings on the camelCase spelling.
 *
 * Auditing that family with `where permission::text like '%organizer%'` returns
 * **one row of eight**, because Postgres `LIKE` is case-sensitive and
 * `eventOrganizer` carries a capital O. A partial result reads exactly like
 * "this family is seeded to zero roles" — which was the hypothesis the checklist
 * item was trying to rule out. `lower(permission::text)` returns all eight,
 * every one correctly granted.
 *
 * Nothing is broken at runtime: the permissions work. What breaks is anyone who
 * audits, writes a guard, or filters by prefix — and the failure mode is the
 * worst kind, an ABSENCE. Zero rows is the most believable false negative there
 * is.
 *
 * ## What this asserts
 *
 * A dotted value whose first two segments concatenate into an EXISTING family
 * prefix is the same domain spelled twice — `event.organizer.*` against the
 * `eventOrganizer.*` family. The 13 that already exist are frozen below as a
 * closed baseline; the assertion is exact equality, so a 14th fails and so does
 * removing one without updating the list.
 *
 * The baseline is not an escape hatch: it enumerates specific known values and
 * admits no new ones. Renaming any of them means a data migration against live
 * `role_permission` rows (`event.organizer.manage` alone is granted to ADMIN,
 * EDITOR and SUPER_ADMIN in production), which is deliberately out of scope —
 * the cost is a real production data change for a defect that today only misleads
 * whoever writes the query.
 */

import { describe, expect, it } from 'vitest';
import { PermissionEnum } from '../../src/enums/permission.enum.js';

/**
 * Values where a dotted spelling shadows an existing camelCase family.
 *
 * Measured against the enum, not hand-listed: every entry was produced by the
 * predicate below. Sorted so a diff stays readable.
 */
const KNOWN_DUAL_SPELLINGS: readonly string[] = [
    'accommodation.review.create',
    'accommodation.review.moderate',
    'accommodation.review.update',
    'destination.review.create',
    'destination.review.moderate',
    'destination.review.update',
    'discountCode.usage.view',
    'event.location.manage',
    'event.location.update',
    'event.organizer.manage',
    'post.sponsor.manage',
    'post.sponsorship.manage',
    'user.bookmark.manage'
];

/**
 * Finds values whose `first.second` segments merge into another family's prefix.
 *
 * @returns Sorted list of offending permission values
 */
const findDualSpelledPermissions = (): string[] => {
    const values = Object.values(PermissionEnum) as string[];
    const familyPrefixes = new Set(values.map((value) => value.split('.')[0]?.toLowerCase()));

    return values
        .filter((value) => {
            const segments = value.split('.');
            if (segments.length < 3) {
                return false;
            }
            const merged = `${segments[0]}${segments[1]}`.toLowerCase();
            return familyPrefixes.has(merged);
        })
        .sort();
};

describe('PermissionEnum naming convention', () => {
    it('has no permission family spelled two ways beyond the frozen baseline', () => {
        // Exact equality, not a subset check: a subset check would let a 14th
        // through as long as the 13 were still there.
        expect(findDualSpelledPermissions()).toEqual([...KNOWN_DUAL_SPELLINGS]);
    });

    it('detects the event-organizer case the smoke actually hit', () => {
        // The instrument check. If the predicate ever stops matching this value,
        // the assertion above keeps passing while measuring nothing.
        expect(findDualSpelledPermissions()).toContain(PermissionEnum.EVENT_ORGANIZER_MANAGE);
    });

    it('confirms the family really does span both spellings', () => {
        const values = Object.values(PermissionEnum) as string[];
        const organizerFamily = values.filter((value) => value.toLowerCase().includes('organizer'));

        // Eight members, only one of which a case-sensitive LIKE '%organizer%'
        // would return — which is the whole finding, restated as an assertion.
        expect(organizerFamily).toHaveLength(8);
        expect(organizerFamily.filter((value) => value.includes('organizer'))).toHaveLength(1);
    });
});
