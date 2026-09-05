/**
 * @file gastronomy.model.contact-info-merge.test.ts
 * @description A partial `contactInfo` PATCH on `gastronomies` must NOT wipe
 * the column.
 *
 * `gastronomies.contact_info` is one JSONB column that can hold several
 * contact fields at once (see `ContactInfoSchema` in `@repo/schemas`).
 * `BaseModelImpl.update()` replaces a JSONB column wholesale unless the model
 * opts the column into merge semantics via `mergeableJsonbColumns` — before
 * this fix `GastronomyModel` never did, so a patch of
 * `{ contactInfo: { mobilePhone: '...' } }` would have silently deleted every
 * other stored contact field. The table is empty in production, so this is a
 * defect fix, not a data-migration.
 *
 * These assertions are about the SQL the model emits, so they need no
 * database: the merge path is observable as (a) a transaction being opened,
 * and (b) the `SET` value for `contactInfo` being a
 * `COALESCE(existing,'{}') || patch` SQL fragment rather than the plain patch
 * object — mirroring `test/models/user.model.settings-merge.test.ts`.
 *
 * Mutation check: removing `contactInfo` from
 * `GastronomyModel.mergeableJsonbColumns` must turn every test in this file
 * red.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '../../../src/client';
import { setDb } from '../../../src/client';
import { GastronomyModel } from '../../../src/models/gastronomy/gastronomy.model';
import { gastronomies } from '../../../src/schemas/gastronomy/gastronomy.dbschema';
import type { DrizzleClient } from '../../../src/types';
import { buildMergeSetClause } from '../../../src/utils/jsonb-merge';

/** The exact shape a "save my phone" PATCH sends. */
const PHONE_PATCH = { mobilePhone: '+541112345678' } as const;

/**
 * Minimal transaction-client stub supporting the two calls the merge path
 * makes: `execute()` for the `SELECT ... FOR UPDATE` lock and
 * `update().set().where().returning()` for the write itself.
 */
function buildMockInnerTx() {
    const returning = vi.fn().mockResolvedValue([{ id: 'gastronomy-1' }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 'gastronomy-1' }] });

    return { execute, update, set, where, returning };
}

/** Minimal non-transactional client for the plain-replacement path. */
function buildMockPlainDb() {
    const returning = vi.fn().mockResolvedValue([{ id: 'gastronomy-1' }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));

    return { update, set };
}

/** Every string chunk of a Drizzle SQL fragment, flattened. */
function sqlStringChunks(fragment: unknown): string[] {
    const chunks = (fragment as { queryChunks?: unknown[] })?.queryChunks ?? [];
    const out: string[] = [];
    for (const chunk of chunks) {
        if (typeof chunk === 'string') {
            out.push(chunk);
            continue;
        }
        const value = (chunk as { value?: unknown })?.value;
        if (typeof value === 'string') out.push(value);
        if (Array.isArray(value)) {
            for (const v of value) if (typeof v === 'string') out.push(v);
        }
    }
    return out;
}

describe('GastronomyModel — `contactInfo` is a mergeable JSONB column', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        setDb(null as unknown as DrizzleClient);
    });

    it('declares `contactInfo` as mergeable', () => {
        // Non-vacuity: contains, not strict-equal — this model already
        // declares `validRelationKeys` separately, and `mergeableJsonbColumns`
        // may legitimately grow (owner decision) without this test needing to
        // be touched. What must never regress is `contactInfo`'s presence.
        const mergeable = (
            new GastronomyModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        expect([...mergeable]).toContain('contactInfo');
    });

    it('opens a transaction for a partial `contactInfo` patch instead of replacing the column', async () => {
        // Arrange
        const innerTx = buildMockInnerTx();
        const withTransaction = vi
            .spyOn(clientModule, 'withTransaction')
            .mockImplementation(async (callback) => callback(innerTx as unknown as DrizzleClient));
        setDb({} as unknown as DrizzleClient);

        // Act
        await new GastronomyModel().update({ id: 'gastronomy-1' }, { contactInfo: PHONE_PATCH });

        // Assert — the merge path is the one that locks the row first.
        expect(withTransaction).toHaveBeenCalledOnce();
        expect(innerTx.execute).toHaveBeenCalledOnce();
        expect(innerTx.update).toHaveBeenCalledOnce();
    });

    it('writes `contactInfo` as a merge fragment, never as the bare patch object', async () => {
        // Arrange
        const innerTx = buildMockInnerTx();
        vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (callback) =>
            callback(innerTx as unknown as DrizzleClient)
        );
        setDb({} as unknown as DrizzleClient);

        // Act
        await new GastronomyModel().update({ id: 'gastronomy-1' }, { contactInfo: PHONE_PATCH });

        // Assert — a plain object here would wipe every other contact field.
        const setPayload = innerTx.set.mock.calls[0]?.[0] as Record<string, unknown>;
        const contactValue = setPayload?.contactInfo as { queryChunks?: unknown[] };

        expect(Array.isArray(contactValue?.queryChunks)).toBe(true);

        const emitted = sqlStringChunks(contactValue).join(' ');
        expect(emitted).toContain('||');
        expect(emitted).toContain('COALESCE');
    });

    it('serialises ONLY the sent key — sibling contact fields are never named, so they survive the `||` merge', () => {
        // Arrange: the real `gastronomies` table and the real mergeable list.
        const mergeable = (
            new GastronomyModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        // Act
        const result = buildMergeSetClause({ contactInfo: PHONE_PATCH }, gastronomies, mergeable);

        // Assert — the patch travels verbatim; any sibling field already
        // stored under a key absent from it is left to `||` to preserve.
        const chunks = sqlStringChunks(result.contactInfo);
        expect(chunks).toStrictEqual(expect.arrayContaining([JSON.stringify(PHONE_PATCH)]));
        const emitted = chunks.join(' ');
        expect(emitted).not.toContain('personalEmail');
        expect(emitted).not.toContain('preferredPhone');
        expect(emitted).not.toContain('whatsapp');
    });

    it('carries an explicit per-key `null` through, so a contact field stays clearable', () => {
        const mergeable = (
            new GastronomyModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        const result = buildMergeSetClause(
            { contactInfo: { mobilePhone: null } },
            gastronomies,
            mergeable
        );

        const chunks = sqlStringChunks(result.contactInfo);
        expect(chunks).toStrictEqual(expect.arrayContaining(['{"mobilePhone":null}']));
    });

    it('still clears the WHOLE column when the patch value itself is null', async () => {
        const innerTx = buildMockInnerTx();
        vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (callback) =>
            callback(innerTx as unknown as DrizzleClient)
        );
        setDb({} as unknown as DrizzleClient);

        await new GastronomyModel().update({ id: 'gastronomy-1' }, {
            contactInfo: null
        } as unknown as Parameters<GastronomyModel['update']>[1]);

        const setPayload = innerTx.set.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(setPayload?.contactInfo).toBeNull();
    });

    it('still replaces a non-mergeable column, so this did not become a blanket merge', async () => {
        // Arrange
        const plainDb = buildMockPlainDb();
        const withTransaction = vi.spyOn(clientModule, 'withTransaction');
        setDb(plainDb as unknown as DrizzleClient);

        // Act — `socialNetworks` is NOT declared mergeable on this model.
        await new GastronomyModel().update({ id: 'gastronomy-1' }, {
            socialNetworks: { facebook: 'https://facebook.com/x' }
        } as unknown as Parameters<GastronomyModel['update']>[1]);

        // Assert
        expect(withTransaction).not.toHaveBeenCalled();
        const setPayload = plainDb.set.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(setPayload?.socialNetworks).toStrictEqual({ facebook: 'https://facebook.com/x' });
    });
});
