import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import { createUser, markAdminToursSeen } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const slug = `adm17-presence-${randomUUID()}`;
const partnerIds: string[] = [];
const ownedUserIds: string[] = [];

test.describe('AC:V7:14 admin moderates and lifts a partner presence with a reason @p0 @admin', () => {
    test.afterAll(async () => {
        const partners = await execSQL<{ id: string }>('SELECT id FROM partners WHERE slug = $1', [
            slug
        ]);
        partnerIds.push(...partners.map(({ id }) => id));
        if (partnerIds.length)
            await execSQL('DELETE FROM partners WHERE id = ANY($1::uuid[])', [partnerIds]);
        // domain_event is append-only (trigger rejects DELETE); its rows stay, as in adm-15.
        if (ownedUserIds.length) await cleanupTestUsers(getDbPool(), ownedUserIds);
    });

    test('moderates and lifts the presence while recording both actions', async ({ page }) => {
        const admin: CreatedUser = await createUser(
            { role: 'SUPER_ADMIN' },
            { apiBaseUrl: API_URL }
        );
        ownedUserIds.push(admin.id);
        await markAdminToursSeen({ userId: admin.id });
        await seedCookieConsent(page);
        const inserted = await execSQL<{ id: string }>(
            `INSERT INTO partners (slug, name, type, presence_moderated)
             VALUES ($1, 'HOS-1488 presence smoke', 'business', false) RETURNING id`,
            [slug]
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
        await page.goto(`${ADMIN_URL}/partners/${partnerId}`, { waitUntil: 'domcontentloaded' });
        const card = page.getByTestId('partner-presence-moderation');
        await expect(card.getByRole('button', { name: 'Moderar presencia' })).toBeVisible();
        const dialog = page.getByTestId('partner-presence-moderation-dialog');
        await expect(async () => {
            const reason = dialog.locator('#partner-presence-moderation-reason');
            if (!(await reason.isVisible())) {
                await card.getByRole('button', { name: 'Moderar presencia' }).click();
            }
            await reason.fill('Moderación de prueba');
            await expect(reason).toHaveValue('Moderación de prueba');
        }).toPass({ timeout: 15_000 });
        const firstPost = page.waitForResponse(
            (response) =>
                response.url() ===
                    `${API_URL}/api/v1/admin/partners/${partnerId}/presence-moderation` &&
                response.request().method() === 'POST' &&
                response.ok()
        );
        await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
        await firstPost;
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ presence_moderated: boolean }>(
                            'SELECT presence_moderated FROM partners WHERE id = $1',
                            [partnerId]
                        )
                    )[0]?.presence_moderated
            )
            .toBe(true);
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ count: string }>(
                            `SELECT count(*)::text AS count FROM domain_event
             WHERE event_type = 'partner.presence_moderation_changed' AND entity_id = $1`,
                            [partnerId]
                        )
                    )[0]?.count
            )
            .toBe('1');
        await expect(card.getByRole('button', { name: 'Levantar moderación' })).toBeVisible();

        await card.getByRole('button', { name: 'Levantar moderación' }).click();
        const liftDialog = page.getByTestId('partner-presence-moderation-dialog');
        await liftDialog.locator('#partner-presence-moderation-reason').fill('La revisión terminó');
        const secondPost = page.waitForResponse(
            (response) =>
                response.url() ===
                    `${API_URL}/api/v1/admin/partners/${partnerId}/presence-moderation` &&
                response.request().method() === 'POST' &&
                response.ok()
        );
        await liftDialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
        await secondPost;
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ presence_moderated: boolean }>(
                            'SELECT presence_moderated FROM partners WHERE id = $1',
                            [partnerId]
                        )
                    )[0]?.presence_moderated
            )
            .toBe(false);
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ count: string }>(
                            `SELECT count(*)::text AS count FROM domain_event
             WHERE event_type = 'partner.presence_moderation_changed' AND entity_id = $1`,
                            [partnerId]
                        )
                    )[0]?.count
            )
            .toBe('2');
    });
});
