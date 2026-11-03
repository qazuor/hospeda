import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import { createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const partnerName = `HOS1487 direct ${randomUUID()}`;
const claimEmail = `adm16-claim-${randomUUID()}@example.test`;
const partnerIds: string[] = [];
const ownedUserIds: string[] = [];

test.describe('AC:V7:11 admin direct partner creation sends the claim notice without an owner @p0 @admin', () => {
    test.afterAll(async () => {
        await execSQL('DELETE FROM email_outbox WHERE lower(recipient_email) = lower($1)', [
            claimEmail
        ]);
        const created = await execSQL<{ id: string }>('SELECT id FROM partners WHERE name = $1', [
            partnerName
        ]);
        partnerIds.push(...created.map(({ id }) => id));
        if (partnerIds.length)
            await execSQL('DELETE FROM partners WHERE id = ANY($1::uuid[])', [partnerIds]);
        // domain_event is append-only (trigger rejects DELETE); its rows stay, as in adm-15.
        if (ownedUserIds.length) await cleanupTestUsers(getDbPool(), ownedUserIds);
    });

    test('creates the Partner without an owner and enqueues one claim notice', async ({ page }) => {
        const admin: CreatedUser = await createUser(
            { role: 'SUPER_ADMIN' },
            { apiBaseUrl: API_URL }
        );
        ownedUserIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        await seedCookieConsent(page);

        await page.context().addCookies(
            admin.sessionCookie.split('; ').map((cookie) => {
                const [name, ...value] = cookie.split('=');
                return { name: (name ?? '').trim(), value: value.join('='), url: ADMIN_URL };
            })
        );
        await page.goto(`${ADMIN_URL}/partners/new`, { waitUntil: 'domcontentloaded' });
        await page.getByLabel('Nombre').fill(partnerName);
        await page.getByLabel('Tipo').selectOption('business');
        await page.getByLabel(/Correo para el aviso de reclamo/).fill(claimEmail);

        const response = page.waitForResponse(
            (candidate) =>
                candidate.url() === `${API_URL}/api/v1/admin/partners` &&
                candidate.request().method() === 'POST' &&
                candidate.ok()
        );
        await page.getByRole('button', { name: 'Crear partner' }).click();
        expect((await response).status()).toBeGreaterThanOrEqual(200);

        const partner = await execSQL<{ id: string; owner_user_id: string | null }>(
            'SELECT id, owner_user_id FROM partners WHERE name = $1',
            [partnerName]
        );
        expect(partner).toHaveLength(1);
        expect(partner[0]?.id).toBeTruthy();
        partnerIds.push(partner[0]?.id ?? '');
        expect(partner[0]?.owner_user_id).toBeNull();

        const queued = await execSQL<{ id: string; template: string; recipient_email: string }>(
            `SELECT id, template, recipient_email FROM email_outbox
             WHERE lower(recipient_email) = lower($1)`,
            [claimEmail]
        );
        expect(queued).toHaveLength(1);
        expect(queued[0]).toEqual({
            id: queued[0]?.id,
            template: 'verticals.partner-claim-notice',
            recipient_email: claimEmail
        });
    });
});
