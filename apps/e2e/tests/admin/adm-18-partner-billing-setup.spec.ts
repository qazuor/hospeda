import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import { createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    cleanupPartnerBillingSetupRows,
    monthlyOptionForSlug
} from '../../fixtures/partner-billing-setup.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const slug = `adm18-billing-${randomUUID()}`;
const partnerIds: string[] = [];
const ownedUserIds: string[] = [];

test.describe('TEST:V7:18 AC:V7:17 admin confirms before the Partner billing setup writes @p0 @admin', () => {
    test.afterAll(async () => {
        const partners = await execSQL<{ id: string }>('SELECT id FROM partners WHERE slug = $1', [
            slug
        ]);
        partnerIds.push(...partners.map(({ id }) => id));
        await cleanupPartnerBillingSetupRows({ userIds: ownedUserIds, partnerIds });
        // domain_event is append-only (trigger rejects DELETE), as in adm-17.
        if (ownedUserIds.length) await cleanupTestUsers(getDbPool(), ownedUserIds);
    });

    test('writes only after the explicit confirmation and hides the action without its permission', async ({
        page
    }) => {
        const admin: CreatedUser = await createUser(
            { role: 'SUPER_ADMIN' },
            { apiBaseUrl: API_URL }
        );
        ownedUserIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        await seedCookieConsent(page);
        const owner = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        ownedUserIds.push(owner.id);
        const optionId = await monthlyOptionForSlug('partner-silver');
        const inserted = await execSQL<{ id: string }>(
            `INSERT INTO partners (slug, name, type, owner_user_id, presence_moderated)
             VALUES ($1, 'HOS-1489 billing setup', 'business', $2, false) RETURNING id`,
            [slug, owner.id]
        );
        const partnerId = inserted[0]?.id;
        if (!partnerId) throw new Error('Expected seeded Partner row.');
        partnerIds.push(partnerId);
        await page.context().addCookies(
            admin.sessionCookie.split('; ').map((cookie) => {
                const [name, ...value] = cookie.split('=');
                return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
            })
        );
        let postObserved = false;
        page.on('request', (request) => {
            if (
                request.url() === `${API_URL}/api/v1/admin/partners/${partnerId}/billing-setup` &&
                request.method() === 'POST'
            )
                postObserved = true;
        });
        await page.goto(`${ADMIN_URL}/partners/${partnerId}`, { waitUntil: 'domcontentloaded' });
        const card = page.getByTestId('partner-billing-setup-card');
        await card.getByRole('button', { name: 'Configurar plan y pago' }).click();
        await page.getByLabel(/Silver/).click();
        await expect(page.locator('input[name="partner-billing-option"]:checked')).toHaveValue(
            optionId
        );
        await page.getByLabel('Motivo').fill('Configuración acordada para TEST:V7:18');
        await page.getByRole('button', { name: 'Revisar' }).click();
        const confirmation = page.getByTestId('partner-billing-setup-confirmation');
        await expect(confirmation).toContainText('HOS-1489 billing setup');
        await expect(confirmation).toContainText('Manual');
        expect(postObserved).toBe(false);
        const before = await execSQL<{ id: string }>(
            'SELECT id FROM subscription WHERE user_id = $1',
            [owner.id]
        );
        expect(before).toEqual([]);

        const postResponse = page.waitForResponse(
            (response) =>
                response.url() === `${API_URL}/api/v1/admin/partners/${partnerId}/billing-setup` &&
                response.request().method() === 'POST' &&
                response.ok()
        );
        await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
        await postResponse;
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ count: string }>(
                            `SELECT count(*)::text AS count FROM subscription WHERE user_id = $1 AND payment_method = 'MANUAL' AND status = 'PENDING_AUTHORIZATION'`,
                            [owner.id]
                        )
                    )[0]?.count
            )
            .toBe('1');
        const saved = await execSQL<{ subscription_id: string; installment_status: string }>(
            `SELECT s.id AS subscription_id, mp.status AS installment_status
               FROM subscription s JOIN manual_payment mp ON mp.subscription_id = s.id
              WHERE s.user_id = $1 AND s.payment_method = 'MANUAL' AND s.status = 'PENDING_AUTHORIZATION'`,
            [owner.id]
        );
        expect(saved).toHaveLength(1);
        expect(saved[0]?.installment_status).toBe('AWAITING');
        const events = await execSQL<{ actor_id: string; entity_id: string; reason: string }>(
            `SELECT actor_id, entity_id, reason FROM domain_event WHERE event_type = 'partner.billing_configured' AND entity_id = $1`,
            [partnerId]
        );
        expect(events).toEqual([
            {
                actor_id: admin.id,
                entity_id: partnerId,
                reason: 'Configuración acordada para TEST:V7:18'
            }
        ]);

        const withoutPermission = await createUser({ role: 'ADMIN' }, { apiBaseUrl: API_URL });
        ownedUserIds.push(withoutPermission.id);
        await markAdminToursSeen({ userId: withoutPermission.id });
        await page.context().clearCookies();
        await page.context().addCookies(
            withoutPermission.sessionCookie.split('; ').map((cookie) => {
                const [name, ...value] = cookie.split('=');
                return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
            })
        );
        await page.goto(`${ADMIN_URL}/partners/${partnerId}`, { waitUntil: 'domcontentloaded' });
        await expect(
            page.getByTestId('partner-billing-setup-card').getByRole('button')
        ).toHaveCount(0);
        expect(optionId).not.toBe('');
    });
});
