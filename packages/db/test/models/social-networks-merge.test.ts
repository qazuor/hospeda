/**
 * @file social-networks-merge.test.ts
 * @description HOS-1262: a partial `socialNetworks` PATCH must NOT wipe the
 * networks the caller did not send, on EVERY model that owns the column.
 *
 * `BaseModelImpl.update()` replaces a JSONB column wholesale unless the model
 * lists it in `mergeableJsonbColumns`. Six models (experience, gastronomy,
 * partner, postSponsor, user, eventOrganizer) shipped without `socialNetworks`
 * in that list, so `{ socialNetworks: { instagram } }` silently deleted
 * `facebook`, `twitter`, and the rest. `accommodation` already declared it and
 * is included as the control.
 *
 * Nothing here needs a database. The merge path is observable as (a) a
 * transaction being opened, and (b) the `SET` value for `socialNetworks` being a
 * `COALESCE(column, '{}') || patch` SQL fragment instead of the bare object.
 * The `||` itself is modelled by {@link jsonbConcat}: the right operand wins on a
 * shared key and every other stored key survives (PostgreSQL `jsonb || jsonb`).
 * Whether real PostgreSQL agrees is HOS-1196's job (no CI job runs the merge
 * against it yet); the fragment SHAPE asserted below is what that job would run.
 *
 * Mutation checks (measured, see the PR): removing `socialNetworks` from any one
 * model's `mergeableJsonbColumns` reddens exactly that model's tests here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '../../src/client';
import { setDb } from '../../src/client';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model';
import { EventOrganizerModel } from '../../src/models/event/eventOrganizer.model';
import { ExperienceModel } from '../../src/models/experience/experience.model';
import { GastronomyModel } from '../../src/models/gastronomy/gastronomy.model';
import { PartnerModel } from '../../src/models/partner/partner.model';
import { PostSponsorModel } from '../../src/models/post/postSponsor.model';
import { UserModel } from '../../src/models/user/user.model';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema';
import { eventOrganizers } from '../../src/schemas/event/event_organizer.dbschema';
import { experiences } from '../../src/schemas/experience/experiences.dbschema';
import { gastronomies } from '../../src/schemas/gastronomy/gastronomy.dbschema';
import { partners } from '../../src/schemas/partner/partner.dbschema';
import { postSponsors } from '../../src/schemas/post/post_sponsor.dbschema';
import { users } from '../../src/schemas/user/user.dbschema';
import type { DrizzleClient } from '../../src/types';
import { buildMergeSetClause } from '../../src/utils/jsonb-merge';

/** What each model needs to be driven and inspected. */
interface Case {
    readonly label: string;
    readonly create: () => {
        update: (where: { id: string }, data: never) => Promise<unknown>;
    };
    readonly table: Parameters<typeof buildMergeSetClause>[1];
    /** The DATABASE column name (differs for `event_organizers.social`). */
    readonly dbColumn: string;
}

const CASES: readonly Case[] = [
    {
        label: 'ExperienceModel',
        create: () => new ExperienceModel() as never,
        table: experiences,
        dbColumn: 'social_networks'
    },
    {
        label: 'GastronomyModel',
        create: () => new GastronomyModel() as never,
        table: gastronomies,
        dbColumn: 'social_networks'
    },
    {
        label: 'PartnerModel',
        create: () => new PartnerModel() as never,
        table: partners,
        dbColumn: 'social_networks'
    },
    {
        label: 'PostSponsorModel',
        create: () => new PostSponsorModel() as never,
        table: postSponsors,
        dbColumn: 'social_networks'
    },
    {
        label: 'UserModel',
        create: () => new UserModel() as never,
        table: users,
        dbColumn: 'social_networks'
    },
    {
        label: 'EventOrganizerModel',
        create: () => new EventOrganizerModel() as never,
        table: eventOrganizers,
        dbColumn: 'social'
    },
    {
        label: 'AccommodationModel (control, already mergeable)',
        create: () => new AccommodationModel() as never,
        table: accommodations,
        dbColumn: 'social_networks'
    }
];

/** The stored value before the PATCH: every network filled in. */
const STORED = {
    facebook: 'https://facebook.com/stored',
    instagram: 'https://instagram.com/stored',
    twitter: 'https://twitter.com/stored',
    linkedIn: 'https://linkedin.com/company/stored',
    tiktok: 'https://tiktok.com/@stored',
    youtube: 'https://youtube.com/@stored'
} as const;

const NEW_INSTAGRAM = 'https://instagram.com/renamed';

/** Minimal transaction client: the `FOR UPDATE` lock plus `update().set()`. */
function buildMockInnerTx() {
    const returning = vi.fn().mockResolvedValue([{ id: 'row-1' }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 'row-1' }] });
    return { execute, update, set };
}

/** The ordered token list of a Drizzle SQL fragment (column chunks named). */
function sqlShape(fragment: unknown): string[] {
    const chunks = (fragment as { queryChunks?: unknown[] })?.queryChunks ?? [];
    return chunks.map((chunk) => {
        if (typeof chunk === 'string') return `<value:${chunk}>`;
        const value = (chunk as { value?: unknown })?.value;
        if (Array.isArray(value)) return value.join('');
        if (typeof value === 'string') return value;
        const name = (chunk as { name?: unknown })?.name;
        return typeof name === 'string' ? `<column:${name}>` : '<unknown>';
    });
}

/** The JSON text of the patch the fragment binds (the one `<value:...>` token). */
function boundPatch(fragment: unknown): Record<string, unknown> {
    const value = sqlShape(fragment).find((token) => token.startsWith('<value:'));
    if (value === undefined) throw new Error('the fragment binds no patch value');
    return JSON.parse(value.slice('<value:'.length, -1)) as Record<string, unknown>;
}

/**
 * PostgreSQL `jsonb || jsonb` on two objects: every key of both sides, the
 * RIGHT operand winning on a shared key.
 */
function jsonbConcat(
    left: Record<string, unknown>,
    right: Record<string, unknown>
): Record<string, unknown> {
    return { ...left, ...right };
}

/** Drives `model.update` through the merge path and returns the `SET` payload. */
async function updateAndCaptureSet(
    model: ReturnType<Case['create']>,
    patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const innerTx = buildMockInnerTx();
    vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (callback) =>
        callback(innerTx as unknown as DrizzleClient)
    );
    setDb({} as unknown as DrizzleClient);

    await model.update({ id: 'row-1' }, patch as never);

    return (innerTx.set.mock.calls[0] as unknown as [Record<string, unknown>])[0];
}

describe.each(CASES)('$label — `socialNetworks` is a mergeable JSONB column', (testCase) => {
    beforeEach(() => {
        vi.restoreAllMocks();
        setDb(null as unknown as DrizzleClient);
    });

    it('declares `socialNetworks` as mergeable', () => {
        const mergeable = (
            testCase.create() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        expect([...mergeable]).toContain('socialNetworks');
    });

    it('writes a one-network patch as `COALESCE(column, {}) || patch`, never as the bare object', async () => {
        // Act — the MIXED payload production sends: `BaseCrudService` staples
        // `updatedById` onto every update, so a lone-key patch never occurs.
        const setPayload = await updateAndCaptureSet(testCase.create(), {
            socialNetworks: { instagram: NEW_INSTAGRAM },
            updatedById: '00000000-0000-4000-8000-000000000001'
        });

        // Assert — the stored column is on the LEFT, the patch on the RIGHT.
        expect(sqlShape(setPayload.socialNetworks)).toStrictEqual([
            'COALESCE(',
            `<column:${testCase.dbColumn}>`,
            ", '{}'::jsonb) || ",
            `<value:${JSON.stringify({ instagram: NEW_INSTAGRAM })}>`,
            '::jsonb'
        ]);
    });

    it('saving ONE network leaves every other stored network in place', async () => {
        // Arrange
        const setPayload = await updateAndCaptureSet(testCase.create(), {
            socialNetworks: { instagram: NEW_INSTAGRAM }
        });

        // Act — what PostgreSQL stores after `column || patch`.
        const stored = jsonbConcat(STORED, boundPatch(setPayload.socialNetworks));

        // Assert — strict: an `undefined`-valued or missing sibling would fail.
        expect(stored).toStrictEqual({ ...STORED, instagram: NEW_INSTAGRAM });
    });

    it('a per-key `null` reaches the database as a JSON null and touches no other network', async () => {
        // Arrange — the "clear my Facebook" save.
        const setPayload = await updateAndCaptureSet(testCase.create(), {
            socialNetworks: { facebook: null }
        });

        // Act
        const patch = boundPatch(setPayload.socialNetworks);
        const stored = jsonbConcat(STORED, patch);

        // Assert — the patch names the cleared key with `null` (an omitted key
        // would leave the stored link alone), and the other five survive. The
        // value is a JSON null, which every read schema accepts and every reader
        // treats as absent.
        expect(patch).toStrictEqual({ facebook: null });
        expect(stored).toStrictEqual({ ...STORED, facebook: null });
    });

    it('still clears the WHOLE column when the patch value itself is null', async () => {
        const setPayload = await updateAndCaptureSet(testCase.create(), { socialNetworks: null });

        expect(setPayload.socialNetworks).toBeNull();
    });

    it('serialises only the sent key, so a sibling is never named in the SQL', () => {
        const mergeable = (
            testCase.create() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        const result = buildMergeSetClause(
            { socialNetworks: { instagram: NEW_INSTAGRAM } },
            testCase.table,
            mergeable
        );

        expect(Object.keys(boundPatch(result.socialNetworks))).toStrictEqual(['instagram']);
    });
});
