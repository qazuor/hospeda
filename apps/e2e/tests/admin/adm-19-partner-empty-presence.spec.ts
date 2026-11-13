import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import { createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const uniqueId = randomUUID();
const partnerSlug = `adm19-empty-${uniqueId}`;
const partnerName = `HOS-1498 action 25 ${uniqueId}`;
const reason = 'Owner requested manual account closure';
const partnerIds: string[] = [];
const ownedUserIds: string[] = [];

test.describe('TEST:V8b:7 AC:V8b:6 the action 25 confirmation names the Partner, says it does not come back and empties the presence @p0 @admin', () => {
    test.afterAll(async () => {
        if (partnerIds.length)
            await execSQL('DELETE FROM partners WHERE id = ANY($1::uuid[])', [partnerIds]);
        // domain_event is append-only and intentionally remains as audit history.
        if (ownedUserIds.length) await cleanupTestUsers(getDbPool(), ownedUserIds);
    });

    test('names the irreversible action and empties the Partner presence only after confirmation', async ({
        page
    }) => {
        const admin: CreatedUser = await createUser(
            { role: 'SUPER_ADMIN' },
            { apiBaseUrl: API_URL }
        );
        ownedUserIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        await seedCookieConsent(page);
        const rows = await execSQL<{ id: string }>(
            `INSERT INTO partners (
                slug, name, type, logo_url, description, website_url, social_networks,
                content_review_state, pending_description
            ) VALUES (
                $1, $2, 'business', 'https://images.example.test/logo.png',
                'Current description', 'https://example.test',
                '{"instagram":"https://www.instagram.com/hospeda-e2e-adm19"}'::jsonb,
                'pending', 'Pending description'
            ) RETURNING id`,
            [partnerSlug, partnerName]
        );
        const partnerId = rows[0]?.id;
        if (!partnerId) throw new Error('Expected the seeded Partner row.');
        partnerIds.push(partnerId);

        await page.context().addCookies(
            admin.sessionCookie.split('; ').map((cookie) => {
                const [name, ...value] = cookie.split('=');
                return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
            })
        );
        await page.goto(`${ADMIN_URL}/partners/${partnerId}`, { waitUntil: 'domcontentloaded' });
        const card = page.getByTestId('partner-empty-presence');
        await expect(card.getByTestId('partner-empty-presence-open')).toBeVisible();
        await card.getByTestId('partner-empty-presence-open').click();
        const dialog = page.getByTestId('partner-empty-presence-dialog');
        await expect(dialog).toContainText(partnerName);
        await expect(dialog).toContainText('Este contenido se borra y no vuelve.');
        await expect(dialog).toContainText('El Partner, su cobro y su postulación no se tocan.');
        await expect(dialog.getByTestId('partner-empty-presence-confirm')).toBeDisabled();

        await dialog.getByTestId('partner-empty-presence-cancel').click();
        // Wait for the closing dialog to unmount: its animate-out overlay intercepts clicks on the reopened one.
        await expect(dialog).toBeHidden();
        await expect(page.locator('[data-slot="alert-dialog-overlay"]')).toHaveCount(0);
        const preserved = await execSQL<{ description: string | null; logo_url: string | null }>(
            'SELECT description, logo_url FROM partners WHERE id = $1',
            [partnerId]
        );
        expect(preserved).toEqual([
            { description: 'Current description', logo_url: 'https://images.example.test/logo.png' }
        ]);
        const noEventYet = await execSQL<{ event_type: string }>(
            "SELECT event_type FROM domain_event WHERE event_type = 'partner.presence_emptied' AND entity_id = $1",
            [partnerId]
        );
        expect(noEventYet).toEqual([]);

        await card.getByTestId('partner-empty-presence-open').click();
        const reopened = page.getByTestId('partner-empty-presence-dialog');
        await expect(reopened).toBeVisible();
        await reopened.getByTestId('partner-empty-presence-reason').fill(reason);
        const post = page.waitForResponse(
            (response) =>
                response.url() === `${API_URL}/api/v1/admin/partners/${partnerId}/empty-presence` &&
                response.request().method() === 'POST' &&
                response.ok()
        );
        await reopened.getByTestId('partner-empty-presence-confirm').click();
        await post;

        await expect
            .poll(async () =>
                execSQL<{
                    name: string;
                    slug: string;
                    logo_url: string | null;
                    website_url: string | null;
                    description: string | null;
                    contact_info: unknown;
                    social_networks: unknown;
                    pending_logo_url: string | null;
                    pending_description: string | null;
                    pending_website_url: string | null;
                    content_review_state: string | null;
                    content_review_note: string | null;
                }>(
                    `SELECT name, slug, logo_url, website_url, description, contact_info, social_networks,
                    pending_logo_url, pending_description, pending_website_url,
                    content_review_state, content_review_note
               FROM partners WHERE id = $1`,
                    [partnerId]
                )
            )
            .toEqual([
                {
                    name: partnerName,
                    slug: partnerSlug,
                    logo_url: null,
                    website_url: null,
                    description: null,
                    contact_info: null,
                    social_networks: null,
                    pending_logo_url: null,
                    pending_description: null,
                    pending_website_url: null,
                    content_review_state: null,
                    content_review_note: null
                }
            ]);
        const events = await execSQL<{
            event_type: string;
            entity_id: string;
            actor_id: string;
            reason: string;
        }>(
            "SELECT event_type, entity_id, actor_id, reason FROM domain_event WHERE event_type = 'partner.presence_emptied' AND entity_id = $1",
            [partnerId]
        );
        expect(events).toEqual([
            {
                event_type: 'partner.presence_emptied',
                entity_id: partnerId,
                actor_id: admin.id,
                reason
            }
        ]);
        await expect(page.getByText('Sin descripción')).toBeVisible();
    });
});
