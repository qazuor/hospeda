/**
 * Integration tests for the one-time social credential vault data migration
 * (HOS-64 T-025).
 *
 * Exercises `migrateSocialCredentialsToVault` against a real test DB:
 *   - Full migration: all 4 keys created and round-trip to their plaintext.
 *   - Idempotency: re-running with the same source is a no-op (skippedExisting),
 *     no duplicate `social_credential_audit` rows.
 *   - Partial source: keys with no (or blank) plaintext value are skipped,
 *     not created, without erroring the whole run.
 *
 * DB: testDb.setup() / testDb.clean() / testDb.teardown() for full isolation.
 * `social_credential_audit.actor_id` is a real FK to `users.id` — a real
 * user row is seeded fresh in `beforeEach` (same requirement documented in
 * `social-credential-vault-roundtrip.test.ts`, T-035).
 *
 * @module test/integration/social/social-vault-migration
 */

import { getDb, socialCredentialAudit } from '@repo/db';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getDecryptedSocialCredential } from '../../../src/services/social-credential-vault.service';
import { migrateSocialCredentialsToVault } from '../../../src/services/social-vault-migration.service';
import { validateApiEnv } from '../../../src/utils/env';
import { createTestUser } from '../../e2e/setup/seed-helpers';
import { testDb } from '../../e2e/setup/test-database';

describe('Social credential vault data migration (HOS-64 T-025)', () => {
    let actorId: string;

    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    beforeEach(async () => {
        const actor = await createTestUser({ role: RoleEnum.SUPER_ADMIN });
        actorId = actor.id;
    });

    it('creates all 4 credentials and each round-trips to its plaintext', async () => {
        const source = {
            makeWebhookUrl: 'https://hook.make.com/migrated',
            makeApiKey: 'migrated-make-api-key',
            aiSocialKey: 'migrated-ai-social-key',
            operatorPin: '1234'
        };

        const result = await migrateSocialCredentialsToVault({ source, actorId });

        expect(result.errors).toEqual([]);
        expect(result.skippedExisting).toEqual([]);
        expect(result.skippedNoSource).toEqual([]);
        expect(result.created).toEqual(
            expect.arrayContaining([
                'make_webhook_url',
                'make_api_key',
                'ai_social_key',
                'operator_pin'
            ])
        );
        expect(result.created).toHaveLength(4);

        const webhook = await getDecryptedSocialCredential({ key: 'make_webhook_url' });
        expect(webhook.data?.plaintext).toBe(source.makeWebhookUrl);

        const makeApiKey = await getDecryptedSocialCredential({ key: 'make_api_key' });
        expect(makeApiKey.data?.plaintext).toBe(source.makeApiKey);

        const aiSocialKey = await getDecryptedSocialCredential({ key: 'ai_social_key' });
        expect(aiSocialKey.data?.plaintext).toBe(source.aiSocialKey);

        const operatorPin = await getDecryptedSocialCredential({ key: 'operator_pin' });
        expect(operatorPin.data?.plaintext).toBe(source.operatorPin);
    });

    it('re-running with the same source is a no-op — skips all 4, no duplicate audit rows', async () => {
        const source = {
            makeWebhookUrl: 'https://hook.make.com/migrated',
            makeApiKey: 'migrated-make-api-key',
            aiSocialKey: 'migrated-ai-social-key',
            operatorPin: '1234'
        };

        const first = await migrateSocialCredentialsToVault({ source, actorId });
        expect(first.created).toHaveLength(4);

        const second = await migrateSocialCredentialsToVault({ source, actorId });
        expect(second.created).toEqual([]);
        expect(second.errors).toEqual([]);
        expect(second.skippedExisting).toEqual(
            expect.arrayContaining([
                'make_webhook_url',
                'make_api_key',
                'ai_social_key',
                'operator_pin'
            ])
        );
        expect(second.skippedExisting).toHaveLength(4);

        const db = getDb();
        for (const key of [
            'make_webhook_url',
            'make_api_key',
            'ai_social_key',
            'operator_pin'
        ] as const) {
            const auditRows = await db
                .select()
                .from(socialCredentialAudit)
                .where(
                    and(
                        eq(socialCredentialAudit.key, key),
                        eq(socialCredentialAudit.action, 'created')
                    )
                );
            expect(auditRows).toHaveLength(1);
        }
    });

    it('skips keys with no source value without erroring the rest of the run', async () => {
        const result = await migrateSocialCredentialsToVault({
            source: {
                makeWebhookUrl: 'https://hook.make.com/migrated',
                makeApiKey: undefined,
                aiSocialKey: null,
                operatorPin: '   '
            },
            actorId
        });

        expect(result.errors).toEqual([]);
        expect(result.created).toEqual(['make_webhook_url']);
        expect(result.skippedNoSource).toEqual(
            expect.arrayContaining(['make_api_key', 'ai_social_key', 'operator_pin'])
        );
        expect(result.skippedNoSource).toHaveLength(3);

        const makeApiKey = await getDecryptedSocialCredential({ key: 'make_api_key' });
        expect(makeApiKey.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });
});
