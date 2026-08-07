/**
 * @file user.model.settings-merge.test.ts
 * @description HOS-375 — a partial `settings` (or `profile`) PATCH must NOT
 * wipe the column.
 *
 * `users.settings` is one JSONB column holding EVERY per-user preference
 * namespace at once: `themeWeb`, `languageWeb`, `notifications`, `newsletter`,
 * `searchHistoryEnabled`, `publicProfileShowSocialNetworks`, and the whole
 * `onboarding` subtree. `BaseModelImpl.update()` replaces a JSONB column
 * wholesale unless the model opts the column into merge semantics, so before
 * this fix a patch of `{ settings: { publicProfileShowSocialNetworks: true } }`
 * — exactly what the web profile form sends — deleted every other namespace.
 *
 * These assertions are about the SQL the model emits, so they need no database:
 * the merge path is observable as (a) a transaction being opened, and (b) the
 * `SET` value for `settings` being a `COALESCE(existing,'{}') || patch` SQL
 * fragment rather than the plain patch object. Dropping `settings` from
 * `UserModel.mergeableJsonbColumns` turns every test here red.
 *
 * The second suite applies the same reasoning to `profile`, where the stakes
 * are higher: it holds `bio` + `avatar`, which decide whether an author page is
 * indexed and listed in the sitemap, and its two writers each know only half
 * the keys.
 *
 * The end-to-end proof that siblings actually survive a round trip lives in
 * `test/integration/user-settings-merge.integration.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '../../src/client';
import { setDb } from '../../src/client';
import { UserModel } from '../../src/models/user/user.model';
import { users } from '../../src/schemas/user/user.dbschema';
import type { DrizzleClient } from '../../src/types';
import { buildMergeSetClause } from '../../src/utils/jsonb-merge';

/** The exact partial patch the web profile form's social opt-in produces. */
const SOCIAL_OPT_IN_PATCH = { publicProfileShowSocialNetworks: true } as const;

/**
 * Minimal transaction-client stub supporting the two calls the merge path
 * makes: `execute()` for the `SELECT ... FOR UPDATE` lock and
 * `update().set().where().returning()` for the write itself.
 */
function buildMockInnerTx() {
    const returning = vi.fn().mockResolvedValue([{ id: 'user-1' }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 'user-1' }] });

    return { execute, update, set, where, returning };
}

/** Minimal non-transactional client for the plain-replacement path. */
function buildMockPlainDb() {
    const returning = vi.fn().mockResolvedValue([{ id: 'user-1' }]);
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

describe('UserModel — `settings` is a mergeable JSONB column (HOS-375)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        setDb(null as unknown as DrizzleClient);
    });

    it('opens a transaction for a partial `settings` patch instead of replacing the column', async () => {
        // Arrange
        const innerTx = buildMockInnerTx();
        const withTransaction = vi
            .spyOn(clientModule, 'withTransaction')
            .mockImplementation(async (callback) => callback(innerTx as unknown as DrizzleClient));
        setDb({} as unknown as DrizzleClient);

        // Act
        await new UserModel().update({ id: 'user-1' }, { settings: SOCIAL_OPT_IN_PATCH });

        // Assert — the merge path is the one that locks the row first.
        expect(withTransaction).toHaveBeenCalledOnce();
        expect(innerTx.execute).toHaveBeenCalledOnce();
        expect(innerTx.update).toHaveBeenCalledOnce();
    });

    it('writes `settings` as a merge fragment, never as the bare patch object', async () => {
        // Arrange
        const innerTx = buildMockInnerTx();
        vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (callback) =>
            callback(innerTx as unknown as DrizzleClient)
        );
        setDb({} as unknown as DrizzleClient);

        // Act
        await new UserModel().update({ id: 'user-1' }, { settings: SOCIAL_OPT_IN_PATCH });

        // Assert — a plain object here would be a full-column replacement.
        const setPayload = innerTx.set.mock.calls[0]?.[0] as Record<string, unknown>;
        const settingsValue = setPayload?.settings as { queryChunks?: unknown[] };

        expect(Array.isArray(settingsValue?.queryChunks)).toBe(true);

        const emitted = sqlStringChunks(settingsValue).join(' ');
        // The `||` concatenation is what preserves siblings; COALESCE is what
        // makes it work when the column is still NULL.
        expect(emitted).toContain('||');
        expect(emitted).toContain('COALESCE');
    });

    it('serialises ONLY the sent key into the patch — siblings are never named', () => {
        // Arrange: the real `users` table and the real mergeable list.
        const mergeable = (
            new UserModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        // Act
        const result = buildMergeSetClause({ settings: SOCIAL_OPT_IN_PATCH }, users, mergeable);

        // Assert: the patch travels verbatim; anything already stored under a
        // key absent from it is left to the `||` operator to preserve.
        const chunks = sqlStringChunks(result.settings);
        expect(chunks).toContain(JSON.stringify(SOCIAL_OPT_IN_PATCH));
        expect(chunks.join(' ')).not.toContain('themeWeb');
        expect(chunks.join(' ')).not.toContain('onboarding');
    });

    it('declares `settings`, `profile` and `contactInfo` — and nothing else — as mergeable', () => {
        // Non-vacuity: the three tests above all pass trivially if the model
        // ever widens the list to every JSONB column, which would make
        // `socialNetworks`/`location` un-clearable by omission without any of
        // their writers being taught the explicit-null rule. Pin the exact set.
        const mergeable = (
            new UserModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        expect([...mergeable]).toEqual(['settings', 'profile', 'contactInfo']);
    });

    it('still replaces a non-mergeable column, so this did not become a blanket merge', async () => {
        // Arrange
        const plainDb = buildMockPlainDb();
        const withTransaction = vi.spyOn(clientModule, 'withTransaction');
        setDb(plainDb as unknown as DrizzleClient);

        // Act — `socialNetworks` is NOT declared mergeable.
        await new UserModel().update(
            { id: 'user-1' },
            { socialNetworks: { facebook: 'https://facebook.com/x' } }
        );

        // Assert
        expect(withTransaction).not.toHaveBeenCalled();
        const setPayload = plainDb.set.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(setPayload?.socialNetworks).toEqual({ facebook: 'https://facebook.com/x' });
    });
});

/**
 * `users.profile` holds `bio`, `avatar`, `website` and `occupation` in ONE JSONB
 * value, and since HOS-375 `bio` + `avatar` decide whether an author page is
 * indexed and listed in the sitemap. The two writers each know only half the
 * keys — the web form owns `bio`/`website`/`occupation`, the admin form owns
 * `bio`/`avatar` — so under replacement semantics either one silently deleted
 * the other's half on every save.
 */
describe('UserModel — `profile` is a mergeable JSONB column (HOS-375)', () => {
    /** The exact patch the web profile form sends when a website is added. */
    const WEB_PROFILE_PATCH = { website: 'https://example.com' } as const;

    beforeEach(() => {
        vi.restoreAllMocks();
        setDb(null as unknown as DrizzleClient);
    });

    it('opens a transaction for a partial `profile` patch instead of replacing the column', async () => {
        // Arrange
        const innerTx = buildMockInnerTx();
        const withTransaction = vi
            .spyOn(clientModule, 'withTransaction')
            .mockImplementation(async (callback) => callback(innerTx as unknown as DrizzleClient));
        setDb({} as unknown as DrizzleClient);

        // Act
        await new UserModel().update({ id: 'user-1' }, { profile: WEB_PROFILE_PATCH });

        // Assert — the merge path is the one that locks the row first.
        expect(withTransaction).toHaveBeenCalledOnce();
        expect(innerTx.execute).toHaveBeenCalledOnce();
        expect(innerTx.update).toHaveBeenCalledOnce();
    });

    it('writes `profile` as a merge fragment, never as the bare patch object', async () => {
        // Arrange
        const innerTx = buildMockInnerTx();
        vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (callback) =>
            callback(innerTx as unknown as DrizzleClient)
        );
        setDb({} as unknown as DrizzleClient);

        // Act
        await new UserModel().update({ id: 'user-1' }, { profile: WEB_PROFILE_PATCH });

        // Assert — a plain object here would wipe `avatar` and de-index the
        // author page.
        const setPayload = innerTx.set.mock.calls[0]?.[0] as Record<string, unknown>;
        const profileValue = setPayload?.profile as { queryChunks?: unknown[] };

        expect(Array.isArray(profileValue?.queryChunks)).toBe(true);

        const emitted = sqlStringChunks(profileValue).join(' ');
        expect(emitted).toContain('||');
        expect(emitted).toContain('COALESCE');
    });

    it('never names the sibling keys it is not patching', () => {
        // Arrange: the real `users` table and the real mergeable list.
        const mergeable = (
            new UserModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        // Act
        const result = buildMergeSetClause({ profile: WEB_PROFILE_PATCH }, users, mergeable);

        // Assert — `avatar`/`bio` are left entirely to the `||` operator.
        const chunks = sqlStringChunks(result.profile);
        expect(chunks).toContain(JSON.stringify(WEB_PROFILE_PATCH));
        expect(chunks.join(' ')).not.toContain('avatar');
        expect(chunks.join(' ')).not.toContain('bio');
    });

    it('carries an explicit per-key `null` through, so a field stays clearable', () => {
        // Non-vacuity partner for the tests above: merge semantics only make a
        // sibling safe if omission means "leave alone", which in turn means the
        // ONLY way to clear a field is an explicit null. If the merge dropped
        // that null the fix would have traded a wipe bug for a field the user
        // can never empty again.
        const mergeable = (
            new UserModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        const result = buildMergeSetClause({ profile: { bio: null } }, users, mergeable);

        const chunks = sqlStringChunks(result.profile);
        // The JSON null rides INSIDE the patch value (`{"bio":null}`), which
        // `||` writes over the stored key. It is NOT a bare SQL NULL, which
        // would clear the whole column.
        expect(chunks).toContain('{"bio":null}');
    });

    it('still clears the WHOLE column when the patch value itself is null', async () => {
        // The column-level escape hatch must survive the opt-in: `profile: null`
        // is plain assignment (see `buildMergeSetClause`), because
        // `existing || 'null'::jsonb` is array concatenation in PostgreSQL and
        // would corrupt the value instead of clearing it.
        const innerTx = buildMockInnerTx();
        vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (callback) =>
            callback(innerTx as unknown as DrizzleClient)
        );
        setDb({} as unknown as DrizzleClient);

        await new UserModel().update({ id: 'user-1' }, { profile: null } as unknown as Parameters<
            UserModel['update']
        >[1]);

        const setPayload = innerTx.set.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(setPayload?.profile).toBeNull();
    });
});

/**
 * `users.contactInfo` holds NINE keys in ONE JSONB value — `personalEmail`,
 * `workEmail`, `homePhone`, `workPhone`, `mobilePhone`, `whatsapp`, `website`,
 * `preferredEmail`, `preferredPhone`.
 *
 * Every writer models a strict subset. The web profile form and the mobile
 * `use-patch-user` hook each send exactly `{ mobilePhone }`, so under
 * replacement semantics one phone edit deleted the other eight keys — including
 * `website`, which the very same web page reads back as the fallback for the
 * profile website field.
 */
describe('UserModel — `contactInfo` is a mergeable JSONB column (HOS-375)', () => {
    /** The exact patch the web/mobile profile forms send on a phone change. */
    const PHONE_PATCH = { mobilePhone: '+541112345678' } as const;

    beforeEach(() => {
        vi.restoreAllMocks();
        setDb(null as unknown as DrizzleClient);
    });

    it('opens a transaction for a partial `contactInfo` patch instead of replacing the column', async () => {
        // Arrange
        const innerTx = buildMockInnerTx();
        const withTransaction = vi
            .spyOn(clientModule, 'withTransaction')
            .mockImplementation(async (callback) => callback(innerTx as unknown as DrizzleClient));
        setDb({} as unknown as DrizzleClient);

        // Act
        await new UserModel().update({ id: 'user-1' }, { contactInfo: PHONE_PATCH });

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
        await new UserModel().update({ id: 'user-1' }, { contactInfo: PHONE_PATCH });

        // Assert — a plain object here would wipe `website` and the seven other
        // contact keys this form knows nothing about.
        const setPayload = innerTx.set.mock.calls[0]?.[0] as Record<string, unknown>;
        const contactValue = setPayload?.contactInfo as { queryChunks?: unknown[] };

        expect(Array.isArray(contactValue?.queryChunks)).toBe(true);

        const emitted = sqlStringChunks(contactValue).join(' ');
        expect(emitted).toContain('||');
        expect(emitted).toContain('COALESCE');
    });

    it('never names the sibling keys it is not patching', () => {
        // Arrange: the real `users` table and the real mergeable list.
        const mergeable = (
            new UserModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        // Act
        const result = buildMergeSetClause({ contactInfo: PHONE_PATCH }, users, mergeable);

        // Assert — `website`/`personalEmail`/`preferredPhone` are left entirely
        // to the `||` operator.
        const chunks = sqlStringChunks(result.contactInfo);
        expect(chunks).toContain(JSON.stringify(PHONE_PATCH));
        const emitted = chunks.join(' ');
        expect(emitted).not.toContain('website');
        expect(emitted).not.toContain('personalEmail');
        expect(emitted).not.toContain('preferredPhone');
    });

    it('carries an explicit per-key `null` through, so a contact field stays clearable', () => {
        // Non-vacuity partner: merge semantics only make a sibling safe if
        // omission means "leave alone", which in turn means the ONLY way to
        // clear a key is an explicit null. If the merge dropped that null the
        // fix would have traded a wipe bug for a phone the user can never empty.
        const mergeable = (
            new UserModel() as unknown as { mergeableJsonbColumns: readonly string[] }
        ).mergeableJsonbColumns;

        const result = buildMergeSetClause(
            { contactInfo: { mobilePhone: null } },
            users,
            mergeable
        );

        const chunks = sqlStringChunks(result.contactInfo);
        // The JSON null rides INSIDE the patch value (`{"mobilePhone":null}`),
        // which `||` writes over the stored key. It is NOT a bare SQL NULL,
        // which would clear the whole column.
        expect(chunks).toContain('{"mobilePhone":null}');
    });

    it('still clears the WHOLE column when the patch value itself is null', async () => {
        // The column-level escape hatch must survive the opt-in: `contactInfo:
        // null` is plain assignment (see `buildMergeSetClause`), because
        // `existing || 'null'::jsonb` is array concatenation in PostgreSQL and
        // would corrupt the value instead of clearing it.
        const innerTx = buildMockInnerTx();
        vi.spyOn(clientModule, 'withTransaction').mockImplementation(async (callback) =>
            callback(innerTx as unknown as DrizzleClient)
        );
        setDb({} as unknown as DrizzleClient);

        await new UserModel().update({ id: 'user-1' }, {
            contactInfo: null
        } as unknown as Parameters<UserModel['update']>[1]);

        const setPayload = innerTx.set.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(setPayload?.contactInfo).toBeNull();
    });
});
