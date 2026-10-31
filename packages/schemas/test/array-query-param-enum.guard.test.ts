/**
 * Fail-closed guard: an array query param cannot skip enum validation (HOS-1974).
 *
 * ## The defect this exists to prevent
 *
 * `createArrayQueryParam` only splits a CSV into strings. Used bare on a filter
 * whose items come from an enum, it lets any value through the schema and the
 * raw string reaches the model layer; against an enum column Postgres rejects
 * it and the client sees a 500 `INTERNAL_ERROR`, which `error-contract.md`
 * forbids (a malformed input is a 400). HOS-1938 fixed one such filter by
 * hand; HOS-1974 moved the pattern into `createEnumArrayQueryParam`.
 *
 * ## The rule
 *
 * Whether a param is "an enum" is a semantic fact a regex cannot see, so the
 * guard inverts the question: every call to the bare `createArrayQueryParam`
 * must appear in the reviewed allowlist below, each with the reason its items
 * are free-form (ids, names, tags). A NEW array param therefore fails CI until
 * its author either uses `createEnumArrayQueryParam` or consciously adds an
 * allowlist entry. A stale entry (no longer in the source) fails too, so the
 * list cannot rot into a blanket exemption.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '..', 'src');
const HELPER_FILE = 'api/http/base-http.schema.ts';

/** `relative/path.ts:paramKey` -> why the items are not an enum. */
const NON_ENUM_ARRAY_PARAMS: Readonly<Record<string, string>> = {
    'entities/post/post.http.schema.ts:tags': 'tag UUIDs',
    'entities/event/event.http.schema.ts:tags': 'free-form tag names',
    'entities/destination/destination.http.schema.ts:tags': 'tag UUIDs',
    'entities/eventLocation/eventLocation.http.schema.ts:destinationIds': 'destination UUIDs',
    'entities/accommodation/accommodation.http.schema.ts:destinationIds': 'destination UUIDs',
    'entities/attraction/attraction.http.schema.ts:destinations': 'destination UUIDs',
    'entities/attraction/attraction.http.schema.ts:icons':
        'attractions.icon is a free text column, there is no icon enum',
    'entities/point-of-interest/point-of-interest.http.schema.ts:destinations': 'destination UUIDs',
    'entities/feature/feature.query.schema.ts:categories':
        'features have no category column or enum',
    'entities/feature/feature.http.schema.ts:categories':
        'features have no category column or enum',
    'entities/amenity/amenity.http.schema.ts:categories':
        'amenities have no category column or enum (the enum is `type`)',
    'entities/postSponsor/postSponsor.http.schema.ts:industries': 'free-form industry text',
    'entities/postSponsor/postSponsor.http.schema.ts:names': 'free-form names',
    'entities/eventOrganizer/eventOrganizer.http.schema.ts:emails': 'email addresses',
    'entities/eventOrganizer/eventOrganizer.http.schema.ts:names': 'free-form names',
    'entities/userBookmark/userBookmark.http.schema.ts:userIds': 'UUIDs',
    'entities/userBookmark/userBookmark.http.schema.ts:accommodationIds': 'UUIDs',
    'entities/userBookmark/userBookmark.http.schema.ts:destinationIds': 'UUIDs',
    'entities/userBookmark/userBookmark.http.schema.ts:postIds': 'UUIDs',
    'entities/userBookmark/userBookmark.http.schema.ts:tagIds': 'UUIDs',
    'entities/userBookmark/userBookmark.http.schema.ts:eventIds': 'UUIDs'
};

/** Matches `key: createArrayQueryParam(` with the key captured. */
const BARE_CALL = /(\w+)\s*:\s*createArrayQueryParam\s*\(/g;
/** Any call, keyed or not, to catch shapes BARE_CALL cannot name. */
const ANY_CALL = /createArrayQueryParam\s*\(/g;

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return listSourceFiles(full);
        return full.endsWith('.ts') ? [full] : [];
    });
}

/** Strips comments so docblocks that mention the helper do not count as calls. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function collectBareCalls(): { found: Set<string>; unkeyed: string[] } {
    const found = new Set<string>();
    const unkeyed: string[] = [];
    for (const file of listSourceFiles(SRC_ROOT)) {
        const rel = relative(SRC_ROOT, file).split('\\').join('/');
        if (rel === HELPER_FILE) continue;
        const code = stripComments(readFileSync(file, 'utf8'));
        const keyed = [...code.matchAll(BARE_CALL)];
        for (const match of keyed) found.add(`${rel}:${match[1]}`);
        const total = [...code.matchAll(ANY_CALL)].length;
        // A call that is not `key: createArrayQueryParam(` (aliased, spread,
        // wrapped) cannot be matched to the allowlist, so it is rejected.
        if (total !== keyed.length) unkeyed.push(rel);
    }
    return { found, unkeyed };
}

describe('array query params cannot skip enum validation (HOS-1974)', () => {
    const { found, unkeyed } = collectBareCalls();

    it('finds the bare calls (the scan is not vacuous)', () => {
        expect(found.size).toBeGreaterThan(10);
    });

    it('every bare createArrayQueryParam is on the reviewed non-enum allowlist', () => {
        const unreviewed = [...found].filter((entry) => !(entry in NON_ENUM_ARRAY_PARAMS));
        expect(
            unreviewed,
            'Use createEnumArrayQueryParam(description, EnumSchema) for an enum-backed filter, ' +
                'or add the param to NON_ENUM_ARRAY_PARAMS with the reason its items are free-form.'
        ).toEqual([]);
    });

    it('has no createArrayQueryParam call the scan cannot attribute to a key', () => {
        expect(unkeyed).toEqual([]);
    });

    it('has no stale allowlist entry', () => {
        const stale = Object.keys(NON_ENUM_ARRAY_PARAMS).filter((entry) => !found.has(entry));
        expect(stale).toEqual([]);
    });
});
