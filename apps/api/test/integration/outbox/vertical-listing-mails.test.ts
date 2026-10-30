/**
 * TEST:V8a:6 (HOS-1492, AC:V8a:5 row 27 «le llegó el correo»; AC:V8a:6 row 31):
 * a real listing purged by PB12 through the owner's route, with a tourist's
 * price alert on it. The production outbox render (`buildOutboxSenderRender`,
 * with the real listing names reader) sends both mails it enqueued:
 * `verticals.price-alert-closed` to the tourist and `verticals.listing-purged`
 * to the owner, and both rows end `sent`, re-read by SQL.
 *
 * Real app, database and models, and the real `processEmailOutboxBatch`. Only
 * the transport, the reporting hooks and the publication ports (as in the
 * other publication route suites) are fakes. Cleans its own rows.
 *
 * Mutation: removing the listing notice renderers from the sender leaves both
 * rows unsent (no renderer for their template).
 */
import { emailOutboxModel, getDb, notificationLogModel, sql, touristPriceAlerts } from '@repo/db';
import { type EmailTransport, processEmailOutboxBatch } from '@repo/notifications';
import { PermissionEnum, PublicationStatusEnum } from '@repo/schemas';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { buildOutboxSenderRender } from '../../../src/cron/jobs/email-outbox-sender.job';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createTrial,
    createVerticalDestination,
    ensureAccommodationCatalog,
    MATRIX_NOW,
    readResponse,
    resetPublicationControls
} from '../listing-publication/publication-routes.helpers';

vi.mock('../../../src/utils/listing-publication/ports', async (importOriginal) => {
    const { buildMatrixPublicationPorts } = await import(
        '../listing-publication/publication-routes.helpers'
    );
    return buildMatrixPublicationPorts(await importOriginal());
});

const { mediaDelete } = vi.hoisted(() => ({ mediaDelete: vi.fn() }));
vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({ delete: mediaDelete })
}));

const app = initApp({ clock: { now: () => MATRIX_NOW } });
const createdUsers: string[] = [];
const createdListings: string[] = [];

async function user(): Promise<string> {
    const { id } = await createOwner();
    createdUsers.push(id);
    return id;
}

interface OutboxState {
    readonly template: string;
    readonly status: string;
    readonly providerMessageId: string | null;
    readonly lastError: string | null;
}

async function readOutbox(recipientIds: readonly string[]): Promise<readonly OutboxState[]> {
    const result = await getDb().execute(
        sql<OutboxState>`SELECT template, status, provider_message_id AS "providerMessageId", last_error AS "lastError"
            FROM email_outbox
            WHERE recipient_user_id = ANY(${sql.param([...recipientIds])}::uuid[])
            ORDER BY template`
    );
    return result.rows as unknown as OutboxState[];
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});

afterEach(async () => {
    const users = createdUsers.splice(0);
    const listings = createdListings.splice(0);
    if (listings.length > 0) {
        const ids = sql.param(listings);
        await getDb().execute(
            sql`DELETE FROM tourist_price_alerts WHERE accommodation_id = ANY(${ids}::uuid[])`
        );
        await getDb().execute(
            sql`UPDATE accommodations SET deleted_at = now() WHERE id = ANY(${ids}::uuid[]) AND deleted_at IS NULL`
        );
    }
    if (users.length > 0) {
        const recipients = sql.param(users);
        await getDb().execute(
            sql`DELETE FROM notification_log WHERE recipient IN (SELECT recipient_email FROM email_outbox WHERE recipient_user_id = ANY(${recipients}::uuid[]))`
        );
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE recipient_user_id = ANY(${recipients}::uuid[])`
        );
    }
});

afterAll(async () => testDb.teardown());

describe('TEST:V8a:6 the listing notice mails of a purge leave through the production sender', () => {
    it('sends the closed-alert mail to the tourist and the purge mail to the owner, both sent', async () => {
        // Arrange — a PUBLISHED listing and a tourist's active price alert on it
        await ensureAccommodationCatalog();
        resetPublicationControls();
        const ownerId = await user();
        const touristId = await user();
        await createTrial({ userId: ownerId, status: 'TRIAL_ACTIVE' });
        const listingId = await createListing({
            ownerId,
            destinationId: await createVerticalDestination(),
            status: PublicationStatusEnum.PUBLISHED
        });
        createdListings.push(listingId);
        const [alert] = await getDb()
            .insert(touristPriceAlerts)
            .values({ userId: touristId, accommodationId: listingId, basePriceSnapshot: 10000 })
            .returning({ id: touristPriceAlerts.id });
        if (!alert) throw new Error('Fixture insert failed');

        // PB12 through the owner's real route
        const purge = await readResponse(
            await app.request(`/api/v1/protected/accommodations/${listingId}/purge`, {
                method: 'POST',
                headers: actorHeaders({
                    id: ownerId,
                    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
                })
            })
        );
        expect(purge.status).toBe(200);
        const queued = await readOutbox([ownerId, touristId]);
        expect(queued.map((row) => [row.template, row.status])).toEqual([
            ['verticals.listing-purged', 'pending'],
            ['verticals.price-alert-closed', 'pending']
        ]);

        const sent: Array<{ to: string; subject: string; html: string }> = [];
        const send = vi.fn<EmailTransport['send']>(async (mail) => {
            sent.push({
                to: mail.to,
                subject: mail.subject,
                html: renderToStaticMarkup(mail.react)
            });
            return { messageId: `msg-${crypto.randomUUID()}` };
        });

        // Act — the real batch with the production render
        await processEmailOutboxBatch({
            deps: {
                outbox: emailOutboxModel,
                log: notificationLogModel,
                isOptedOut: async () => false,
                render: buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' }),
                transport: { send },
                escalate: vi.fn(),
                onRowError: vi.fn(),
                onRetry: vi.fn(),
                onLeaseLost: vi.fn()
            },
            owner: 'v8a-mails-it',
            now: new Date(),
            leaseMs: 300_000,
            batchSize: 1000
        });

        // Assert — both rows sent, re-read by SQL field by field
        const after = await readOutbox([ownerId, touristId]);
        expect(after).toHaveLength(2);
        for (const row of after) {
            expect(row.status).toBe('sent');
            expect(row.providerMessageId).toMatch(/^msg-/);
            expect(row.lastError).toBeNull();
        }
        const alertMail = sent.find((mail) => mail.subject === 'Tu alerta de precio se cerró');
        const purgeMail = sent.find((mail) => mail.subject === 'Se borró tu ficha');
        expect(alertMail?.html).toContain(
            'La alerta de precio que tenías sobre Matrix listing se cerró porque esa ficha ya no existe.'
        );
        expect(purgeMail?.html).toContain('Se borró tu ficha Matrix listing.');
        expect(purgeMail?.html).toContain('La ficha no vuelve');
        expect(purgeMail?.html).not.toContain('a pedido tuyo');
    });
});
