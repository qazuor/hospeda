/**
 * @file user-settings-merge.integration.test.ts
 * @description HOS-375 — a partial `users.settings` (or `users.profile`) PATCH
 * must preserve every sibling key, proven against a real PostgreSQL instance.
 *
 * The unit tests (`test/models/user.model.settings-merge.test.ts`) assert the
 * SQL the model emits. What they cannot assert is what PostgreSQL then DOES
 * with it — `||` is the operator that preserves siblings, and only the database
 * can confirm that a stored `{themeWeb, onboarding, ...}` survives a write that
 * mentions none of those keys.
 *
 * The concrete regression: the web profile form's social opt-in sends exactly
 * `{ settings: { publicProfileShowSocialNetworks: true } }`. Under the previous
 * replace semantics, ticking that checkbox erased the user's theme, language,
 * notification preferences, newsletter flag and the whole onboarding subtree.
 *
 * Each case runs inside a rolled-back transaction, so fixtures never persist.
 */

import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { UserModel } from '../../src/models/user/user.model';
import { users } from '../../src/schemas/user/user.dbschema';
import { closeTestPool, testData, withTestTransaction } from './helpers';

/**
 * Gate on the EPHEMERAL test database provisioned by `pnpm test:integration`,
 * not on the legacy `isDbAvailable()` helper (which reads the dev DB URL and
 * would silently skip this suite even while the harness is running).
 */
const DB_AVAILABLE = Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);

const model = new UserModel();

/** A fully-populated settings object — one key per namespace that exists. */
const STORED_SETTINGS = {
    themeWeb: 'dark',
    languageWeb: 'es',
    newsletter: true,
    searchHistoryEnabled: false,
    notifications: { enabled: true, allowEmails: true, allowSms: false, allowPush: false },
    onboarding: {
        adminTours: { 'host.welcome': 1 },
        whatsNew: { baselineAt: '2026-01-01T00:00:00.000Z', seenIds: ['entry-1'] }
    }
} as const;

describe.skipIf(!DB_AVAILABLE)('users.settings — partial PATCH preserves siblings', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    it('keeps every stored namespace when the patch names only one key', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — a user whose settings hold every namespace.
            const row = testData.user({ settings: STORED_SETTINGS });
            await tx.insert(users).values(row);

            // Act — the exact payload the web social opt-in sends.
            await model.update(
                { id: row.id },
                { settings: { publicProfileShowSocialNetworks: true } },
                tx
            );

            // Assert — the new key landed AND nothing else was lost.
            const stored = await model.findById(row.id as string, tx);
            expect(stored?.settings).toEqual({
                ...STORED_SETTINGS,
                publicProfileShowSocialNetworks: true
            });
        });
    });

    it('overwrites the key it names, so the merge is not a no-op', async () => {
        await withTestTransaction(async (tx) => {
            // Non-vacuity guard for the case above: a merge that silently
            // dropped the patch would also "preserve every sibling".
            const row = testData.user({
                settings: { ...STORED_SETTINGS, publicProfileShowSocialNetworks: true }
            });
            await tx.insert(users).values(row);

            await model.update(
                { id: row.id },
                { settings: { publicProfileShowSocialNetworks: false } },
                tx
            );

            const stored = await model.findById(row.id as string, tx);
            expect(
                (stored?.settings as Record<string, unknown>).publicProfileShowSocialNetworks
            ).toBe(false);
            expect((stored?.settings as Record<string, unknown>).themeWeb).toBe('dark');
        });
    });

    it('merges into the column DEFAULT for a user who never touched their settings', async () => {
        await withTestTransaction(async (tx) => {
            // The freshly-signed-up case, and the most common one in production:
            // the row carries only `users.settings`' column default (the
            // `notifications` block — the column is NOT NULL, so it is never
            // actually SQL NULL). Ticking the opt-in must not cost that user
            // their notification preferences.
            const row = testData.user();
            await tx.insert(users).values(row);
            const seeded = (await model.findById(row.id as string, tx))?.settings as Record<
                string,
                unknown
            >;
            // Non-vacuity: there must BE a default to preserve.
            expect(seeded.notifications).toBeDefined();

            await model.update(
                { id: row.id },
                { settings: { publicProfileShowSocialNetworks: true } },
                tx
            );

            const stored = (await model.findById(row.id as string, tx))?.settings as Record<
                string,
                unknown
            >;
            expect(stored.publicProfileShowSocialNetworks).toBe(true);
            expect(stored.notifications).toEqual(seeded.notifications);
        });
    });

    it('still replaces the whole `onboarding` subtree — the merge is SHALLOW', async () => {
        await withTestTransaction(async (tx) => {
            // Pins the documented limitation rather than an aspiration: callers
            // writing a nested namespace MUST keep doing their own
            // read-modify-write (UserService.markAdminTourSeen, markUserReady).
            const row = testData.user({ settings: STORED_SETTINGS });
            await tx.insert(users).values(row);

            await model.update(
                { id: row.id },
                { settings: { onboarding: { adminTours: { 'admin.welcome': 1 } } } },
                tx
            );

            const stored = (await model.findById(row.id as string, tx))?.settings as Record<
                string,
                unknown
            >;
            // Top-level siblings survive...
            expect(stored.themeWeb).toBe('dark');
            // ...but `whatsNew` inside the replaced subtree does not.
            expect(stored.onboarding).toEqual({ adminTours: { 'admin.welcome': 1 } });
        });
    });
});

/**
 * The same proof for `users.profile`, where the consequence of a wipe is not a
 * lost preference but a de-indexed public URL: `listPublicAuthors` requires a
 * non-empty `bio` AND `avatar`, and the two writers each own only half the
 * keys (web: bio/website/occupation, admin: bio/avatar).
 */
describe.skipIf(!DB_AVAILABLE)('users.profile — partial PATCH preserves siblings', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    /** What an editor has after setting up their author page in the admin. */
    const STORED_PROFILE = {
        bio: 'Editora de contenidos del litoral argentino.',
        avatar: 'https://cdn.example.com/avatars/editor.jpg'
    } as const;

    it('keeps `avatar` when the web form patches only `website`', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — an author page that is currently indexable.
            const row = testData.user({ profile: STORED_PROFILE });
            await tx.insert(users).values(row);

            // Act — the exact payload the web profile form now sends when the
            // user adds a website and touches nothing else.
            await model.update(
                { id: row.id },
                { profile: { website: 'https://example.com' } } as never,
                tx
            );

            // Assert — the key that decides indexability is untouched.
            const stored = (await model.findById(row.id as string, tx))?.profile as Record<
                string,
                unknown
            >;
            expect(stored).toEqual({ ...STORED_PROFILE, website: 'https://example.com' });
        });
    });

    it('keeps `website`/`occupation` when the admin form patches only bio + avatar', async () => {
        await withTestTransaction(async (tx) => {
            // The mirror-image regression: the admin account form knows nothing
            // about the two keys the web form owns.
            const row = testData.user({
                profile: {
                    ...STORED_PROFILE,
                    website: 'https://example.com',
                    occupation: 'Periodista'
                }
            });
            await tx.insert(users).values(row);

            await model.update(
                { id: row.id },
                {
                    profile: {
                        bio: 'Bio nueva escrita desde el admin.',
                        avatar: 'https://cdn.example.com/avatars/nuevo.jpg'
                    }
                } as never,
                tx
            );

            const stored = (await model.findById(row.id as string, tx))?.profile as Record<
                string,
                unknown
            >;
            expect(stored.website).toBe('https://example.com');
            expect(stored.occupation).toBe('Periodista');
            expect(stored.bio).toBe('Bio nueva escrita desde el admin.');
        });
    });

    it('CLEARS a field on an explicit null — merge did not make it un-clearable', async () => {
        await withTestTransaction(async (tx) => {
            // Non-vacuity partner: a merge that preserved everything would also
            // pass the two cases above while silently ignoring a deletion.
            const row = testData.user({
                profile: { ...STORED_PROFILE, website: 'https://example.com' }
            });
            await tx.insert(users).values(row);

            await model.update({ id: row.id }, { profile: { website: null } } as never, tx);

            const stored = (await model.findById(row.id as string, tx))?.profile as Record<
                string,
                unknown
            >;
            expect(stored.website).toBeNull();
            // ...and the sibling keys still survived the clear.
            expect(stored.avatar).toBe(STORED_PROFILE.avatar);
        });
    });

    it('reads a cleared field as ABSENT in the author-indexability predicate', async () => {
        await withTestTransaction(async (tx) => {
            // The stored value after a clear is a JSON null, not a missing key.
            // `listPublicAuthors` filters on
            // `trim(coalesce(profile->>'avatar','')) <> ''` — this pins that a
            // JSON null takes the same branch as a missing key, rather than
            // stringifying to "null" and reading as content.
            const row = testData.user({ profile: STORED_PROFILE });
            await tx.insert(users).values(row);
            await model.update({ id: row.id }, { profile: { avatar: null } } as never, tx);

            const probe = await tx.execute(
                sql`SELECT trim(coalesce(profile->>'avatar', '')) <> '' AS has_avatar
                    FROM users WHERE id = ${row.id}`
            );
            const hasAvatar = (probe as unknown as { rows: Array<{ has_avatar: boolean }> }).rows[0]
                ?.has_avatar;
            expect(hasAvatar).toBe(false);
        });
    });
});

/**
 * The same proof for `users.contactInfo`, the widest of the three merged
 * columns: NINE keys in one JSONB value, and every writer models a strict
 * subset of them. The web profile form and the mobile `use-patch-user` hook each
 * send exactly `{ mobilePhone }`, so under replace semantics a phone save
 * deleted `website` — which the web edit page reads back as the fallback for the
 * profile website field.
 */
describe.skipIf(!DB_AVAILABLE)('users.contactInfo — partial PATCH preserves siblings', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    /** A populated contact block: one key per shape the column can hold. */
    const STORED_CONTACT = {
        personalEmail: 'maria@example.com',
        workEmail: 'maria@empresa.com',
        homePhone: '+541143210000',
        workPhone: '+541143210001',
        mobilePhone: '+541112345678',
        whatsapp: '+541112345678',
        website: 'https://maria.example.com',
        preferredEmail: 'WORK',
        preferredPhone: 'MOBILE'
    } as const;

    it('keeps all eight siblings when the web form patches only `mobilePhone`', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const row = testData.user({ contactInfo: STORED_CONTACT });
            await tx.insert(users).values(row);

            // Act — the exact payload the web profile form sends on a phone edit.
            await model.update(
                { id: row.id },
                { contactInfo: { mobilePhone: '+541198765432' } } as never,
                tx
            );

            // Assert — the key that actually bit (`website`) survived, and so
            // did everything else.
            const stored = (await model.findById(row.id as string, tx))?.contactInfo as Record<
                string,
                unknown
            >;
            expect(stored).toEqual({ ...STORED_CONTACT, mobilePhone: '+541198765432' });
        });
    });

    it('overwrites the key it names, so the merge is not a no-op', async () => {
        await withTestTransaction(async (tx) => {
            // Non-vacuity guard: a merge that silently dropped the patch would
            // also "preserve every sibling".
            const row = testData.user({ contactInfo: STORED_CONTACT });
            await tx.insert(users).values(row);

            await model.update(
                { id: row.id },
                { contactInfo: { mobilePhone: '+541100000000' } } as never,
                tx
            );

            const stored = (await model.findById(row.id as string, tx))?.contactInfo as Record<
                string,
                unknown
            >;
            expect(stored.mobilePhone).toBe('+541100000000');
            expect(stored.website).toBe(STORED_CONTACT.website);
        });
    });

    it('CLEARS a key on an explicit null — merge did not make it un-clearable', async () => {
        await withTestTransaction(async (tx) => {
            // Non-vacuity partner: a merge that preserved everything would also
            // pass the two cases above while silently ignoring a deletion. This
            // is the payload the form now sends when the user empties the phone.
            const row = testData.user({ contactInfo: STORED_CONTACT });
            await tx.insert(users).values(row);

            await model.update({ id: row.id }, { contactInfo: { mobilePhone: null } } as never, tx);

            const stored = (await model.findById(row.id as string, tx))?.contactInfo as Record<
                string,
                unknown
            >;
            expect(stored.mobilePhone).toBeNull();
            // ...and the sibling keys still survived the clear.
            expect(stored.website).toBe(STORED_CONTACT.website);
            expect(stored.personalEmail).toBe(STORED_CONTACT.personalEmail);
        });
    });

    it('reads a cleared key as ABSENT via ->> , not as the string "null"', async () => {
        await withTestTransaction(async (tx) => {
            // The stored value after a clear is a JSON null, not a missing key.
            // Every SQL read path of this column uses the same
            // `trim(coalesce(col->>'key','')) <> ''` idiom the author-indexability
            // predicate uses; this pins that a JSON null takes the ABSENT branch
            // rather than stringifying to "null" and reading as a real number.
            const row = testData.user({ contactInfo: STORED_CONTACT });
            await tx.insert(users).values(row);
            await model.update({ id: row.id }, { contactInfo: { mobilePhone: null } } as never, tx);

            const probe = await tx.execute(
                sql`SELECT trim(coalesce(contact_info->>'mobilePhone', '')) <> '' AS has_phone
                    FROM users WHERE id = ${row.id}`
            );
            const hasPhone = (probe as unknown as { rows: Array<{ has_phone: boolean }> }).rows[0]
                ?.has_phone;
            expect(hasPhone).toBe(false);
        });
    });

    it('still clears the WHOLE column when the patch value itself is null', async () => {
        await withTestTransaction(async (tx) => {
            // The column-level escape hatch survives the merge opt-in: this is
            // plain assignment, not `existing || 'null'::jsonb` (which PostgreSQL
            // would treat as array concatenation and corrupt the value).
            const row = testData.user({ contactInfo: STORED_CONTACT });
            await tx.insert(users).values(row);

            await model.update({ id: row.id }, { contactInfo: null } as never, tx);

            const stored = (await model.findById(row.id as string, tx))?.contactInfo;
            expect(stored).toBeNull();
        });
    });
});
