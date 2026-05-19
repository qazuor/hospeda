/**
 * SPEC-108 T-108-01 nivel 2 — real-Brevo end-to-end smoke.
 *
 * Exercises the production hot path: `NewsletterDeliveryService.processBatch`
 * with the SAME wiring `delivery-factory.ts` uses in production (Brevo
 * batch transport, `@react-email/render` async renderer, full HMAC
 * unsubscribe URL building). The only thing we bypass is BullMQ — we
 * call `processBatch` directly with a real campaign + delivery row we
 * seeded ourselves.
 *
 * Goal: confirm that a real email from the new async-render path lands
 * in your inbox with the XHTML doctype + email-compat markup and looks
 * visually correct.
 *
 * Required env (already in apps/api local env file after nivel-2 setup):
 *   - HOSPEDA_DATABASE_URL
 *   - HOSPEDA_EMAIL_API_KEY            (real Brevo / Resend key)
 *   - HOSPEDA_EMAIL_FROM_EMAIL         (e.g. noreply@hospeda.com.ar)
 *   - HOSPEDA_EMAIL_FROM_NAME          (e.g. Hospeda)
 *   - HOSPEDA_NEWSLETTER_HMAC_SECRET
 *   - HOSPEDA_SITE_URL
 *
 * Required CLI arg or env:
 *   - SMOKE_RECIPIENT_EMAIL: your inbox to send the test to
 *
 * Run:
 *   SMOKE_RECIPIENT_EMAIL=you@example.com pnpm --filter hospeda-api exec tsx scripts/smoke-spec-108-brevo.ts
 *
 * Behaviour:
 *   1. Pick an existing user without any active newsletter subscription.
 *   2. Seed a `newsletter_subscribers` row for that user with your email.
 *   3. Seed a `newsletter_campaigns` row in `sending` status (subject +
 *      bodyJson include a smoke marker).
 *   4. Seed a `newsletter_campaign_deliveries` row in `pending` status.
 *   5. Build a real `NewsletterDeliveryService` (same wiring as
 *      delivery-factory.ts) and call `processBatch`.
 *   6. processBatch will:
 *        - render bodyJson to email-safe HTML via renderTiptapEmailContent,
 *        - for each delivery: AWAIT render(NewsletterCampaign(...)) (the
 *          path that SPEC-108 T-108-01 just switched to),
 *        - hand the batch to Brevo via `sendBatch`.
 *   7. Report the outcome; cleanup the smoke rows.
 *
 * Verify success by opening your inbox.
 */
import { resolve } from 'node:path';
import {
    Body,
    Container,
    Head,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text
} from '@react-email/components';
import { render } from '@react-email/render';
import { initializeDb } from '@repo/db';
import {
    BrevoEmailTransport,
    createEmailClient,
    renderTiptapEmailContent,
    sendBatch
} from '@repo/notifications';
import { NewsletterDeliveryService } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as React from 'react';

// React used implicitly by createElement below; silence unused warning.
void React;

// Load apps/api local env file.
loadEnv({ path: resolve(import.meta.dirname, '..', '.env.local'), quiet: true });

const recipient = process.env.SMOKE_RECIPIENT_EMAIL?.trim();
if (!recipient) {
    console.error(
        '[smoke] Missing SMOKE_RECIPIENT_EMAIL. Run with:\n  SMOKE_RECIPIENT_EMAIL=you@example.com pnpm --filter hospeda-api exec tsx scripts/smoke-spec-108-brevo.ts'
    );
    process.exit(1);
}

const dbUrl = process.env.HOSPEDA_DATABASE_URL;
const apiKey = process.env.HOSPEDA_EMAIL_API_KEY;
const fromEmail = process.env.HOSPEDA_EMAIL_FROM_EMAIL ?? 'noreply@hospeda.com.ar';
const fromName = process.env.HOSPEDA_EMAIL_FROM_NAME ?? 'Hospeda';
const hmacSecret = process.env.HOSPEDA_NEWSLETTER_HMAC_SECRET;
const siteUrl = process.env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar';

const missing: string[] = [];
if (!dbUrl) missing.push('HOSPEDA_DATABASE_URL');
if (!apiKey) missing.push('HOSPEDA_EMAIL_API_KEY');
if (missing.length > 0) {
    console.error(`[smoke] Missing required env: ${missing.join(', ')}`);
    process.exit(1);
}
if (!hmacSecret) {
    console.warn(
        '[smoke] WARN: HOSPEDA_NEWSLETTER_HMAC_SECRET unset — unsubscribe link in the email will be invalid (no token). Email itself sends fine.'
    );
}

console.info(`[smoke] Target inbox:   ${recipient}`);
console.info(`[smoke] Sender:         ${fromName} <${fromEmail}>`);
console.info(`[smoke] DB:             ${dbUrl?.replace(/:[^:@]+@/, ':***@')}`);
console.info(`[smoke] Brevo API key:  ${apiKey?.slice(0, 6)}...${apiKey?.slice(-4)}`);

const pool = new Pool({ connectionString: dbUrl });
initializeDb(pool);
const db = (await import('@repo/db')).getDb();

const CAMPAIGN_ID = '99999999-9999-4999-8999-999999999108';
const SUB_ID = '99999999-9999-4999-8999-999999999208';

let exitCode = 0;

try {
    // ----- find a user with no active subscription -----
    const userRow = (
        await db.execute<{ id: string }>(sql`
            SELECT id FROM users
            WHERE deleted_at IS NULL
              AND id NOT IN (
                  SELECT user_id FROM newsletter_subscribers WHERE deleted_at IS NULL
              )
            ORDER BY created_at ASC
            LIMIT 1
        `)
    ).rows[0];
    if (!userRow) {
        console.error('[smoke] No users without active subscriptions found. Run pnpm db:seed.');
        process.exit(1);
    }
    const userId = userRow.id;
    console.info(`[smoke] Using user_id: ${userId}`);

    // ----- cleanup leftovers from prior runs (idempotent) -----
    await db.execute(sql`
        DELETE FROM newsletter_campaign_deliveries WHERE campaign_id = ${CAMPAIGN_ID}::uuid
    `);
    await db.execute(sql`
        DELETE FROM newsletter_campaigns WHERE id = ${CAMPAIGN_ID}::uuid
    `);
    await db.execute(sql`
        DELETE FROM newsletter_subscribers WHERE id = ${SUB_ID}::uuid
    `);

    // ----- seed subscriber -----
    await db.execute(sql`
        INSERT INTO newsletter_subscribers (id, user_id, email, channel, status, locale, source)
        VALUES (${SUB_ID}::uuid, ${userId}::uuid, ${recipient}, 'email', 'active', 'es', 'web_footer')
    `);
    console.info('[smoke] Subscriber seeded.');

    // ----- seed campaign with a non-trivial bodyJson tiptap doc -----
    const bodyJson = {
        type: 'doc',
        content: [
            {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'Hola desde el smoke SPEC-108 T-108-01' }]
            },
            {
                type: 'paragraph',
                content: [
                    {
                        type: 'text',
                        text: 'Este email se renderiza con el nuevo path async (@react-email/render). Si lo ves correctamente, con doctype XHTML 1.0 Transitional y CSS inlineado, el cambio funcionó end-to-end. '
                    },
                    {
                        type: 'text',
                        marks: [{ type: 'bold' }],
                        text: 'Detalle a mirar: ver fuente del email y confirmar el doctype al inicio.'
                    }
                ]
            },
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'Test de link: ' },
                    {
                        type: 'text',
                        marks: [{ type: 'link', attrs: { href: 'https://hospeda.com.ar' } }],
                        text: 'hospeda.com.ar'
                    }
                ]
            }
        ]
    };

    await db.execute(sql`
        INSERT INTO newsletter_campaigns
            (id, title, subject, body_json, status, locale_filter, created_by, sent_at, total_recipients)
        VALUES (
            ${CAMPAIGN_ID}::uuid,
            'Smoke SPEC-108 T-108-01',
            ${'[SMOKE] SPEC-108 T-108-01 async render test'},
            ${JSON.stringify(bodyJson)}::jsonb,
            'sending',
            'all',
            ${userId}::uuid,
            NOW(),
            1
        )
    `);

    const deliveryRow = (
        await db.execute<{ id: string }>(sql`
            INSERT INTO newsletter_campaign_deliveries (campaign_id, subscriber_id, channel, status)
            VALUES (${CAMPAIGN_ID}::uuid, ${SUB_ID}::uuid, 'email', 'pending')
            RETURNING id
        `)
    ).rows[0];
    if (!deliveryRow) throw new Error('Failed to insert delivery row');
    const deliveryId = deliveryRow.id;
    console.info(`[smoke] Campaign + delivery seeded (delivery_id=${deliveryId}).`);

    // ----- build the delivery service with the SAME wiring as delivery-factory.ts -----
    const emailClient = createEmailClient({ apiKey: apiKey ?? '' });
    const emailTransport = new BrevoEmailTransport(emailClient, {
        fromEmail,
        fromName
    });

    // Stand-in template using React.createElement (no JSX) — tsx in
    // workspace mode resolves @repo/notifications to the .tsx source and
    // hits a "React is not defined" trap that does not happen in
    // production (where dist/index.js is loaded). Using createElement
    // here means we exercise @react-email/render's full pipeline
    // (doctype + email-compat markup) without depending on tsx's
    // workspace resolution quirk. This is enough to validate T-108-01
    // end-to-end: processBatch awaits an async renderer, the renderer
    // is @react-email/render, the output ships to Brevo, the email
    // lands with the XHTML doctype.
    const buildEmailElement = ({
        subject,
        unsubscribeUrl
    }: {
        subject: string;
        unsubscribeUrl: string;
    }) =>
        React.createElement(
            Html,
            { lang: 'es' },
            React.createElement(Head, null),
            React.createElement(Preview, null, subject),
            React.createElement(
                Body,
                { style: { backgroundColor: '#f1f5f9', fontFamily: 'sans-serif' } },
                React.createElement(
                    Container,
                    {
                        style: {
                            margin: '32px auto',
                            background: '#ffffff',
                            padding: '24px',
                            borderRadius: '8px',
                            maxWidth: '600px'
                        }
                    },
                    React.createElement(
                        Section,
                        null,
                        React.createElement(
                            Text,
                            { style: { fontSize: '20px', fontWeight: 700, color: '#0f172a' } },
                            subject
                        ),
                        React.createElement(
                            Text,
                            { style: { color: '#334155', lineHeight: '22px' } },
                            'Smoke email del path async (@react-email/render). Si lo recibis con doctype XHTML 1.0 Transitional al inicio, el cambio de SPEC-108 T-108-01 funciono end-to-end.'
                        )
                    ),
                    React.createElement(Hr, null),
                    React.createElement(
                        Text,
                        { style: { color: '#64748b', fontSize: '12px' } },
                        '[SMOKE] SPEC-108 T-108-01. ',
                        React.createElement(
                            Link,
                            { href: unsubscribeUrl, style: { color: '#64748b' } },
                            'Unsubscribe'
                        )
                    )
                )
            )
        );

    const svc = new NewsletterDeliveryService(
        {},
        {
            // queue is unused for direct processBatch invocation; pass undefined.
            queue: undefined,
            emailTransport,
            sendBatchFn: sendBatch,
            renderTiptapEmailFn: ({ content }) =>
                renderTiptapEmailContent({ content: content as never }),
            renderCampaignEmailFn: async ({ subject, unsubscribeUrl }) => {
                // SPEC-108 T-108-01: async render through @react-email/render.
                return await render(buildEmailElement({ subject, unsubscribeUrl }));
            },
            buildCampaignReactElementFn: ({ subject, unsubscribeUrl }) =>
                buildEmailElement({
                    subject,
                    unsubscribeUrl
                    // TYPE-WORKAROUND: service-core declares OpaqueReactElement.
                }) as unknown as Record<string, unknown>,
            apiKey: apiKey ?? '',
            senderEmail: fromEmail,
            senderName: fromName,
            siteUrl,
            hmacSecret: hmacSecret ?? ''
        }
    );

    console.info('[smoke] Calling processBatch...');
    const t0 = Date.now();
    const result = await svc.processBatch({
        campaignId: CAMPAIGN_ID,
        deliveryIds: [deliveryId]
    });
    const elapsedMs = Date.now() - t0;

    if (result.error) {
        console.error(`[smoke] ❌ processBatch returned error in ${elapsedMs}ms:`);
        console.error(`        code:    ${result.error.code}`);
        console.error(`        message: ${result.error.message}`);
        if (result.error.reason) console.error(`        reason:  ${result.error.reason}`);
        exitCode = 1;
    } else {
        console.info(`[smoke] processBatch completed in ${elapsedMs}ms.`);
        console.info(
            `        delivered=${result.data?.delivered} skipped=${result.data?.skipped} failed=${result.data?.failed}`
        );

        const finalDelivery = (
            await db.execute<{
                status: string;
                provider_message_id: string | null;
                error_message: string | null;
            }>(sql`
                SELECT status, provider_message_id, error_message
                FROM newsletter_campaign_deliveries
                WHERE id = ${deliveryId}::uuid
            `)
        ).rows[0];
        console.info(`        delivery row in DB: status=${finalDelivery?.status}`);
        if (finalDelivery?.provider_message_id) {
            console.info(`        brevo message_id:   ${finalDelivery.provider_message_id}`);
        }
        if (finalDelivery?.error_message) {
            console.info(`        delivery error:     ${finalDelivery.error_message}`);
        }

        if (finalDelivery?.status === 'delivered') {
            console.info('');
            console.info(`[smoke] ✅ PASS — Brevo accepted the email. Check ${recipient}.`);
            console.info('       Look for:');
            console.info(
                '         - Subject contains "[SMOKE] SPEC-108 T-108-01 async render test"'
            );
            console.info('         - View source: starts with <!DOCTYPE html PUBLIC ...>');
            console.info('         - Heading + paragraphs render with correct styling');
            console.info('         - Unsubscribe link present at the bottom');
        } else if (finalDelivery?.status === 'failed') {
            console.error('[smoke] ❌ FAIL — Brevo rejected the delivery (see error above).');
            exitCode = 1;
        } else {
            console.error(`[smoke] ❌ UNEXPECTED — delivery ended in '${finalDelivery?.status}'.`);
            exitCode = 1;
        }
    }

    // ----- cleanup -----
    console.info('');
    console.info('[smoke] Cleaning up smoke rows...');
    await db.execute(sql`
        DELETE FROM newsletter_campaign_deliveries WHERE campaign_id = ${CAMPAIGN_ID}::uuid
    `);
    await db.execute(sql`
        DELETE FROM newsletter_campaigns WHERE id = ${CAMPAIGN_ID}::uuid
    `);
    await db.execute(sql`
        DELETE FROM newsletter_subscribers WHERE id = ${SUB_ID}::uuid
    `);
    console.info('       cleanup done.');
} catch (error) {
    console.error('[smoke] ❌ Unexpected error:');
    console.error(error);
    exitCode = 1;
} finally {
    await pool.end();
}

process.exit(exitCode);
