import type { DrizzleClient } from '@repo/db';
import { getDb, sql } from '@repo/db';
import type { ImageProvider } from '@repo/media/server';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CalendarGrantRevoker, PhotoStorage } from '../../../src/services/cutover-v6/ports.js';
import {
    CutoverPhotoStorageError,
    createGoogleGrantRevoker,
    createPhotoStorage
} from '../../../src/services/cutover-v6/step-5b.adapters.js';
import { runStep5b } from '../../../src/services/cutover-v6/step-5b.service.js';
import {
    GoogleOAuthClientError,
    revokeToken
} from '../../../src/services/google-calendar/google-oauth-client.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';

vi.mock('../../../src/services/google-calendar/google-oauth-client.js', async (importOriginal) => {
    const original =
        await importOriginal<
            typeof import('../../../src/services/google-calendar/google-oauth-client.js')
        >();
    return { ...original, revokeToken: vi.fn() };
});

const TABLE = 'cutover_v6_deleted_listing';
const TOKEN = 'refresh-plaintext-secret';
const CIPHER = 'refresh-ciphertext-secret';
const GOOGLE = {
    access_token_ciphertext: 'access-cipher',
    access_token_iv: 'access-iv',
    access_token_auth_tag: 'access-tag',
    refresh_token_ciphertext: CIPHER,
    refresh_token_iv: 'refresh-iv',
    refresh_token_auth_tag: 'refresh-tag',
    external_calendar_id: 'calendar-id',
    provider: 'GOOGLE_CALENDAR'
};
const FEED = {
    ...GOOGLE,
    refresh_token_ciphertext: null,
    refresh_token_iv: null,
    refresh_token_auth_tag: null,
    external_calendar_id: null,
    provider: 'AIRBNB'
};
const calls = { photos: [] as string[], tokens: [] as string[] };

type ListingSeed = {
    readonly entityType: 'accommodation' | 'gastronomy' | 'experience';
    readonly entityId: string;
    readonly slug: string;
    readonly photos?: readonly { readonly publicId: string | null; readonly url: string }[];
    readonly calendarTokens?: readonly Record<string, string | null>[];
};

function storage(failIds: readonly string[] = []): PhotoStorage {
    return {
        async delete({ publicId }) {
            calls.photos.push(publicId);
            if (failIds.includes(publicId)) throw new Error('delete failed');
            return { wasPresent: true };
        }
    };
}

function revoker(
    fail = false,
    outcome: 'revoked' | 'already_invalid' = 'revoked'
): CalendarGrantRevoker {
    return {
        async revoke({ token }) {
            calls.tokens.push(token);
            if (fail) throw new Error('revoke failed');
            return outcome;
        }
    };
}

function resetCalls(): void {
    calls.photos.length = 0;
    calls.tokens.length = 0;
}

async function addListing(db: DrizzleClient, listing: ListingSeed): Promise<void> {
    await db.execute(sql`INSERT INTO ${sql.raw(TABLE)}
        (entity_type, entity_id, slug, photos, calendar_tokens)
        VALUES (${listing.entityType}, ${listing.entityId}::uuid, ${listing.slug},
            ${JSON.stringify(listing.photos ?? [])}::jsonb,
            ${JSON.stringify(listing.calendarTokens ?? [])}::jsonb)`);
}

async function inRollbackTransaction(
    seed: readonly ListingSeed[],
    run: (tx: DrizzleClient) => Promise<void>
): Promise<void> {
    const rollback = new Error('rollback transaction');
    try {
        await getDb().transaction(async (tx) => {
            await tx.execute(sql`DROP TABLE IF EXISTS ${sql.raw(TABLE)}`);
            await tx.execute(sql`CREATE TABLE ${sql.raw(TABLE)} (
                entity_type varchar(32) NOT NULL, entity_id uuid NOT NULL, slug text,
                photos jsonb NOT NULL DEFAULT '[]'::jsonb,
                calendar_tokens jsonb NOT NULL DEFAULT '[]'::jsonb,
                PRIMARY KEY (entity_type, entity_id)
            )`);
            for (const listing of seed) await addListing(tx, listing);
            await run(tx);
            throw rollback;
        });
    } catch (error) {
        if (error !== rollback) throw error;
    }
}

async function tableExists(db: DrizzleClient): Promise<boolean> {
    const result = await db.execute(
        sql`SELECT to_regclass('public.cutover_v6_deleted_listing') AS table_name`
    );
    return result.rows[0]?.table_name !== null;
}

const decryptSecret = ({ ciphertext }: { readonly ciphertext: string }) => ({
    plaintext: ciphertext === CIPHER ? TOKEN : 'access-token'
});

describe('TEST:V6:22 step 5b', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });
    afterAll(async () => testDb.teardown());
    afterEach(() => {
        vi.unstubAllEnvs();
        validateApiEnv();
    });

    it('TEST:1712:2 AC:1712:2 deletes the menu file and dish photos the paso-3 migration carries', async () => {
        resetCalls();
        await inRollbackTransaction(
            [
                {
                    entityType: 'gastronomy',
                    entityId: '00000000-0000-4000-8000-000000000561',
                    slug: 'menu',
                    photos: [
                        { publicId: 'cloud/food', url: 'https://x.test/food' },
                        { publicId: 'cloud/menu', url: 'https://x.test/menu.pdf' },
                        { publicId: 'cloud/dish-one', url: 'https://x.test/dish-one' },
                        { publicId: 'cloud/dish-three', url: '' }
                    ]
                }
            ],
            async (tx) => {
                const result = await runStep5b({
                    db: tx,
                    photoStorage: storage(),
                    grantRevoker: revoker(),
                    decryptSecret,
                    dryRun: false
                });
                expect(result).toEqual({
                    status: 'completed',
                    deleted: 4,
                    alreadyAbsent: 0,
                    unmanaged: 0,
                    revoked: 0,
                    alreadyInvalid: 0,
                    notRevocable: 0,
                    providerFallback: 0,
                    failures: [],
                    listings: [
                        {
                            entityType: 'gastronomy',
                            entityId: '00000000-0000-4000-8000-000000000561'
                        }
                    ]
                });
                expect(calls.photos).toEqual([
                    'cloud/food',
                    'cloud/menu',
                    'cloud/dish-one',
                    'cloud/dish-three'
                ]);
                expect(calls.tokens).toEqual([]);
                expect(await tableExists(tx)).toBe(false);
            }
        );
    });

    it('cleans passage resources, drops the table, and makes the next run a no-op', async () => {
        resetCalls();
        await inRollbackTransaction(
            [
                {
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000501',
                    slug: 'stay',
                    photos: [
                        { publicId: 'cloud/one', url: 'https://x.test/one' },
                        {
                            publicId: null,
                            url: 'https://res.cloudinary.com/demo/image/upload/v1/cloud/two.jpg'
                        }
                    ],
                    calendarTokens: [GOOGLE]
                },
                {
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000502',
                    slug: 'feed',
                    photos: [{ publicId: null, url: 'https://images.example.test/photo.jpg' }],
                    calendarTokens: [FEED]
                },
                {
                    entityType: 'gastronomy',
                    entityId: '00000000-0000-4000-8000-000000000503',
                    slug: 'food',
                    photos: [{ publicId: 'cloud/food', url: 'https://x.test/food' }]
                }
            ],
            async (tx) => {
                const result = await runStep5b({
                    db: tx,
                    photoStorage: storage(),
                    grantRevoker: revoker(),
                    decryptSecret,
                    dryRun: false
                });
                expect(result).toMatchObject({
                    status: 'completed',
                    notRevocable: 1,
                    unmanaged: 1,
                    revoked: 1
                });
                expect(calls.photos.sort()).toEqual(
                    ['cloud/food', 'cloud/one', 'cloud/two'].sort()
                );
                expect(calls.tokens).toEqual([TOKEN]);
                expect(await tableExists(tx)).toBe(false);
                const second = await runStep5b({
                    db: tx,
                    photoStorage: storage(),
                    grantRevoker: revoker(),
                    decryptSecret,
                    dryRun: false
                });
                expect(second.status).toBe('already_done');
                expect(calls.photos).toHaveLength(3);
                expect(calls.tokens).toEqual([TOKEN]);
            }
        );
    });

    it('retains only a failed listing and retries that listing', async () => {
        resetCalls();
        const seed: ListingSeed[] = [
            {
                entityType: 'accommodation',
                entityId: '00000000-0000-4000-8000-000000000511',
                slug: 'a',
                photos: [{ publicId: 'cloud/a', url: 'https://x.test/a' }]
            },
            {
                entityType: 'accommodation',
                entityId: '00000000-0000-4000-8000-000000000512',
                slug: 'b',
                photos: [{ publicId: 'cloud/b', url: 'https://x.test/b' }]
            },
            {
                entityType: 'experience',
                entityId: '00000000-0000-4000-8000-000000000513',
                slug: 'c',
                photos: [{ publicId: 'cloud/c', url: 'https://x.test/c' }]
            }
        ];
        await inRollbackTransaction(seed, async (tx) => {
            const first = await runStep5b({
                db: tx,
                photoStorage: storage(['cloud/b']),
                grantRevoker: revoker(),
                decryptSecret,
                dryRun: false
            });
            expect(first.status).toBe('partial');
            expect(first.failures.map(({ entityId }) => entityId)).toEqual([seed[1]?.entityId]);
            const rows = await tx.execute(
                sql`SELECT entity_id::text AS id FROM ${sql.raw(TABLE)} ORDER BY entity_id`
            );
            expect(rows.rows.map((row) => row.id)).toEqual([seed[1]?.entityId]);
            resetCalls();
            const second = await runStep5b({
                db: tx,
                photoStorage: storage(),
                grantRevoker: revoker(),
                decryptSecret,
                dryRun: false
            });
            expect(second.status).toBe('completed');
            expect(calls.photos).toEqual(['cloud/b']);
            expect(await tableExists(tx)).toBe(false);
        });
    });

    it('dry run leaves external resources and passage rows untouched', async () => {
        resetCalls();
        await inRollbackTransaction(
            [
                {
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000521',
                    slug: 'dry',
                    photos: [{ publicId: 'cloud/dry', url: 'https://x.test/dry' }],
                    calendarTokens: [GOOGLE]
                }
            ],
            async (tx) => {
                const result = await runStep5b({
                    db: tx,
                    photoStorage: storage(),
                    grantRevoker: revoker(),
                    decryptSecret,
                    dryRun: true
                });
                expect(result.status).toBe('dry_run');
                expect(calls.photos).toEqual([]);
                expect(calls.tokens).toEqual([]);
                expect(await tableExists(tx)).toBe(true);
                expect(
                    (await tx.execute(sql`SELECT entity_id FROM ${sql.raw(TABLE)}`)).rows
                ).toHaveLength(1);
            }
        );
    });

    it('does not expose plaintext or ciphertext in results or failures', async () => {
        resetCalls();
        await inRollbackTransaction(
            [
                {
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000531',
                    slug: 'secret',
                    calendarTokens: [GOOGLE]
                }
            ],
            async (tx) => {
                const result = await runStep5b({
                    db: tx,
                    photoStorage: storage(),
                    grantRevoker: revoker(true),
                    decryptSecret,
                    dryRun: false
                });
                expect(JSON.stringify(result)).not.toContain(TOKEN);
                expect(JSON.stringify(result)).not.toContain(CIPHER);
            }
        );
    });

    it('counts already-invalid as closed and unknown providers as non-revocable', async () => {
        resetCalls();
        await inRollbackTransaction(
            [
                {
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000541',
                    slug: 'provider',
                    calendarTokens: [GOOGLE, { ...GOOGLE, provider: 'UNKNOWN_PROVIDER' }]
                }
            ],
            async (tx) => {
                const result = await runStep5b({
                    db: tx,
                    photoStorage: storage(),
                    grantRevoker: revoker(false, 'already_invalid'),
                    decryptSecret,
                    dryRun: false
                });
                expect(result).toMatchObject({
                    status: 'completed',
                    alreadyInvalid: 1,
                    notRevocable: 1
                });
                expect(calls.tokens).toEqual([TOKEN]);
            }
        );
    });

    it('retains the listing when revocation fails', async () => {
        resetCalls();
        await inRollbackTransaction(
            [
                {
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000551',
                    slug: 'failed',
                    calendarTokens: [GOOGLE]
                }
            ],
            async (tx) => {
                const result = await runStep5b({
                    db: tx,
                    photoStorage: storage(),
                    grantRevoker: revoker(true),
                    decryptSecret,
                    dryRun: false
                });
                expect(result.status).toBe('partial');
                expect(result.failures).toHaveLength(1);
                expect(await tableExists(tx)).toBe(true);
            }
        );
    });

    it('refuses a memory provider and names missing Cloudinary variables', () => {
        expect(() => createPhotoStorage({ provider: new InMemoryImageProvider() })).toThrow(
            CutoverPhotoStorageError
        );
        vi.stubEnv('HOSPEDA_CLOUDINARY_CLOUD_NAME', '');
        vi.stubEnv('HOSPEDA_CLOUDINARY_API_KEY', '');
        vi.stubEnv('HOSPEDA_CLOUDINARY_API_SECRET', '');
        validateApiEnv();
        expect(() => createPhotoStorage({ provider: null })).toThrow(
            /missing variables: HOSPEDA_CLOUDINARY_CLOUD_NAME, HOSPEDA_CLOUDINARY_API_KEY, HOSPEDA_CLOUDINARY_API_SECRET/
        );
    });

    it('explains that Cloudinary provider initialization failed when variables are present', () => {
        vi.stubEnv('HOSPEDA_CLOUDINARY_CLOUD_NAME', 'test-cloud');
        vi.stubEnv('HOSPEDA_CLOUDINARY_API_KEY', 'test-key');
        vi.stubEnv('HOSPEDA_CLOUDINARY_API_SECRET', 'test-secret');
        validateApiEnv();
        expect(() => createPhotoStorage({ provider: null })).toThrow(
            /all required variables are set, but provider initialization failed/
        );
        expect(() => createPhotoStorage({ provider: {} as ImageProvider })).toThrow(
            CutoverPhotoStorageError
        );
    });

    it('maps invalid_token to already_invalid and rethrows other provider errors', async () => {
        const adapter = createGoogleGrantRevoker();
        vi.mocked(revokeToken).mockRejectedValueOnce(
            new GoogleOAuthClientError('invalid', 400, { error: 'invalid_token' })
        );
        await expect(adapter.revoke({ token: TOKEN })).resolves.toBe('already_invalid');
        const failure = new GoogleOAuthClientError('denied', 403, { error: 'access_denied' });
        vi.mocked(revokeToken).mockRejectedValueOnce(failure);
        await expect(adapter.revoke({ token: TOKEN })).rejects.toBe(failure);
    });

    it('uses the legacy classification only when provider is absent', async () => {
        resetCalls();
        await inRollbackTransaction(
            [
                {
                    entityType: 'accommodation',
                    entityId: '00000000-0000-4000-8000-000000000542',
                    slug: 'legacy-feed',
                    calendarTokens: [
                        {
                            ...FEED,
                            provider: null,
                            external_calendar_id: null
                        }
                    ]
                }
            ],
            async (tx) => {
                const result = await runStep5b({
                    db: tx,
                    photoStorage: storage(),
                    grantRevoker: revoker(),
                    decryptSecret,
                    dryRun: false
                });
                expect(result.providerFallback).toBe(1);
                expect(result.notRevocable).toBe(1);
                expect(calls.tokens).toEqual([]);
            }
        );
    });
});
