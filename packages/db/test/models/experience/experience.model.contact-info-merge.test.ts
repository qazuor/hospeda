/**
 * @file experience.model.contact-info-merge.test.ts
 * @description A partial `contactInfo` PATCH on `experiences` must NOT wipe
 * the column.
 *
 * `experiences.contact_info` is one JSONB column that can hold several
 * contact fields at once (see `ContactInfoSchema` in `@repo/schemas`).
 * `BaseModelImpl.update()` replaces a JSONB column wholesale unless the model
 * opts the column into merge semantics via `mergeableJsonbColumns` — before
 * this fix `ExperienceModel` never did, so a patch of
 * `{ contactInfo: { mobilePhone: '...' } }` would have silently deleted every
 * other stored contact field. The table held ZERO rows in production when this
 * shipped — soft-deleted ones included — so there was nothing to backfill
 * (owner's measurement, 2026-09-05, HOS-1190). That is a dated observation,
 * not a standing property: re-measure before reusing it to justify skipping a
 * migration.
 *
 * These assertions are about the SQL the model emits, so they need no
 * database: the merge path is observable as (a) a transaction being opened,
 * and (b) the `SET` value for `contactInfo` being a
 * `COALESCE(existing,'{}') || patch` SQL fragment rather than the plain patch
 * object — mirroring `test/models/user.model.settings-merge.test.ts`.
 *
 * Mutation check: removing `contactInfo` from
 * `ExperienceModel.mergeableJsonbColumns` turns 7 of the 8 tests in this file red
 * (measured). The eighth is the negative control — "still replaces a
 * non-mergeable column" — which asserts the UNCHANGED replacement path and is
 * green by design; a header claiming "every test" would be claiming more than
 * the file delivers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '../../../src/client';
import { setDb } from '../../../src/client';
import { ExperienceModel } from '../../../src/models/experience/experience.model';
import { experiences } from '../../../src/schemas/experience/experiences.dbschema';
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
    const returning = vi.fn().mockResolvedValue([{ id: 'experience-1' }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 'experience-1' }] });

    return { execute, update, set, where, returning };
}

/** Minimal non-transactional client for the plain-replacement path. */
function buildMockPlainDb() {
    const returning = vi.fn().mockResolvedValue([{ id: 'experience-1' }]);
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

/**
 * The fragment's chunks as an ORDER-BEARING token list.
 *
 * {@link sqlStringChunks} silently DROPS the column chunk — a Drizzle column
 * carries no `.value` — so a shape derived from it cannot tell
 * `COALESCE(column, '{}')` from `COALESCE('{}', column)`, nor the left
 * operand of `||` from the right. Both of those mutations make every PATCH
 * discard the stored siblings, which is the exact bug this file exists to
 * prevent, and both sailed past `toContain('||')` / `toContain('COALESCE')`.
 */
function sqlShape(fragment: unknown): string[] {
    const chunks = (fragment as { queryChunks?: unknown[] })?.queryChunks ?? [];
    return chunks.map((chunk) => {
        if (typeof chunk === 'string') return `<value:${chunk}>`;
        const value = (chunk as { value?: unknown })?.value;
        if (Array.isArray(value)) return value.join('');
        if (typeof value === 'string') return value;
        const name = (chunk as { name?: unknown })?.name;
        if (typeof name === 'string') return `<column:${name}>`;
        return '<unknown>';
    });
}

describe('ExperienceModel — `contactInfo` is a mergeable JSONB column', () => {
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
            new ExperienceModel() as unknown as { mergeableJsonbColumns: readonly string[] }
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
        await new ExperienceModel().update({ id: 'experience-1' }, { contactInfo: PHONE_PATCH });

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
        await new ExperienceModel().update({ id: 'experience-1' }, { contactInfo: PHONE_PATCH });

        // Assert — a plain object here would wipe every other contact field.
        const setPayload = innerTx.set.mock.calls[0]?.[0] as Record<string, unknown>;
        const contactValue = setPayload?.contactInfo as { queryChunks?: unknown[] };

        expect(Array.isArray(contactValue?.queryChunks)).toBe(true);

        const emitted = sqlStringChunks(contactValue).join(' ');
        expect(emitted).toContain('||');
        expect(emitted).toContain('COALESCE');
    });

    it('serialises ONLY the sent key — sibling contact fields are never named, so they survive the `||` merge', () => {
        // Arrange: the real `experiences` table and the real mergeable list.
        const mergeable = (
            new ExperienceModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        // Act
        const result = buildMergeSetClause({ contactInfo: PHONE_PATCH }, experiences, mergeable);

        // Assert — the patch travels verbatim; any sibling field already
        // stored under a key absent from it is left to `||` to preserve.
        const chunks = sqlStringChunks(result.contactInfo);
        expect(chunks).toStrictEqual(expect.arrayContaining([JSON.stringify(PHONE_PATCH)]));
        const emitted = chunks.join(' ');
        expect(emitted).not.toContain('personalEmail');
        expect(emitted).not.toContain('preferredPhone');
        expect(emitted).not.toContain('whatsapp');
    });

    it('puts COALESCE(column, {}) on the LEFT of `||` and the patch on the RIGHT', () => {
        // The ORDER is the whole contract. `COALESCE('{}'::jsonb, column)` and
        // `patch || COALESCE(column, '{}')` both still contain a `COALESCE`
        // and a `||`, and both throw away every stored sibling on every
        // PATCH — reintroducing the defect this file was written for. Only a
        // token-by-token shape can tell them apart.
        const mergeable = (
            new ExperienceModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        const result = buildMergeSetClause({ contactInfo: PHONE_PATCH }, experiences, mergeable);

        expect(sqlShape(result.contactInfo)).toStrictEqual([
            'COALESCE(',
            '<column:contact_info>',
            ", '{}'::jsonb) || ",
            `<value:${JSON.stringify(PHONE_PATCH)}>`,
            '::jsonb'
        ]);
    });

    it('carries an explicit per-key `null` through, so a contact field stays clearable', () => {
        const mergeable = (
            new ExperienceModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        const result = buildMergeSetClause(
            { contactInfo: { mobilePhone: null } },
            experiences,
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

        await new ExperienceModel().update({ id: 'experience-1' }, {
            contactInfo: null
        } as unknown as Parameters<ExperienceModel['update']>[1]);

        const setPayload = innerTx.set.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(setPayload?.contactInfo).toBeNull();
    });

    it('still replaces a non-mergeable column, so this did not become a blanket merge', async () => {
        // Arrange
        const plainDb = buildMockPlainDb();
        const withTransaction = vi.spyOn(clientModule, 'withTransaction');
        setDb(plainDb as unknown as DrizzleClient);

        // Act — `socialNetworks` is NOT declared mergeable on this model.
        await new ExperienceModel().update({ id: 'experience-1' }, {
            socialNetworks: { facebook: 'https://facebook.com/x' }
        } as unknown as Parameters<ExperienceModel['update']>[1]);

        // Assert
        expect(withTransaction).not.toHaveBeenCalled();
        const setPayload = plainDb.set.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(setPayload?.socialNetworks).toStrictEqual({ facebook: 'https://facebook.com/x' });
    });
});
