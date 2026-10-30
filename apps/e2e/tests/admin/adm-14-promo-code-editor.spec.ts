import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    createUser,
    markAdminToursSeen,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    type FakeWorld
} from '../../fixtures/arrears-cycle.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:18300';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const ownedUsers = new Set<string>();
const ownedPromoIds = new Set<string>();

async function useAdminSession(page: Page, cookie: string): Promise<void> {
    await page.context().addCookies(
        cookie.split('; ').map((part) => {
            const [name, ...value] = part.split('=');
            return { name: name ?? '', value: value.join('='), url: ADMIN_URL };
        })
    );
}

async function seedPromo(code: string): Promise<string> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO promo_code (code, discount_kind, value, all_verticals, verticals, total_quota,
             valid_from, valid_until, stackable, usable_with_another_active, duration_kind, duration_charges)
         VALUES ($1, 'PERCENTAGE', 20, true, NULL, NULL, now() - interval '1 day',
             now() + interval '30 days', false, false, 'N_CHARGES', 3) RETURNING id`,
        [code]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('Expected seeded promo code.');
    ownedPromoIds.add(id);
    return id;
}

test.describe('TEST:B9b:9 AC:B9b:9 promo code editor creates and closes a code @p0 @admin @clock', () => {
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;

    test.beforeAll(async () => {
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({ clock, idNamespace: randomUUID() }),
            clock
        });
        world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
    });

    test.afterAll(async () => {
        if (ownedPromoIds.size)
            await execSQL('DELETE FROM promo_redemption WHERE promo_code_id = ANY($1::uuid[])', [
                [...ownedPromoIds]
            ]);
        if (ownedPromoIds.size)
            await execSQL('DELETE FROM promo_code WHERE id = ANY($1::uuid[])', [
                [...ownedPromoIds]
            ]);
        if (ownedUsers.size) await cleanupArrearsRows({ userIds: [...ownedUsers] });
        await world?.fakeServer.close().catch(() => undefined);
        await world?.mailCapture.close().catch(() => undefined);
    });

    test('creates with a consequence review and closes without changing its redemption', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const superAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        const admin = await createUser({ role: 'ADMIN' }, { apiBaseUrl: API_URL });
        const owner = await createUser({}, { apiBaseUrl: API_URL });
        ownedUsers.add(superAdmin.id);
        ownedUsers.add(admin.id);
        ownedUsers.add(owner.id);
        await markAdminToursSeen({ userId: superAdmin.id });
        await markAdminToursSeen({ userId: admin.id });
        await markProfileCompleted({ userId: owner.id });
        const optionId = await monthlyOptionForSlug('owner-basico');
        const card = await createApiCardSubscription({ user: owner, billingOptionId: optionId });
        const subscriptionId = card.subscriptionId;
        await activateCardSubscription({ fakeServer: world.fakeServer, subscriptionId });
        const code = `E2E${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
        await useAdminSession(page, superAdmin.sessionCookie);
        await page.goto(`${ADMIN_URL}/billing/promo-codes`);
        // The button is in the SSR HTML; a click before hydration is lost (HOS-1889).
        await expect(page.getByTestId('promo-codes-hydration')).toHaveAttribute(
            'data-hydrated',
            'true'
        );
        await page.getByTestId('promo-code-new').click();
        await page.getByLabel('Código (mayúsculas)').fill(code);
        await page.getByLabel('Tipo de descuento').selectOption('PERCENTAGE');
        await page.getByLabel('Valor', { exact: true }).fill('20');
        await page.getByLabel('Duración').selectOption('N_CHARGES');
        await page.getByLabel('Cantidad de cobros').fill('3');
        await page.getByLabel('Cupo total de canjes').fill('');
        await page.getByLabel('Válido hasta').fill('2030-12-31');
        await page.getByRole('button', { name: 'Revisar' }).click();
        const confirmation = page.getByTestId('promo-code-confirmation');
        await expect(confirmation).toContainText('20% por 3 cobros');
        await expect(confirmation).toContainText('Todas las verticales, también las futuras');
        await expect(confirmation).toContainText('Sin tope de canjes, uno por persona');
        await expect(confirmation).toContainText('hasta');
        await page.getByRole('button', { name: 'Crear', exact: true }).click();
        const created = page.locator(`[data-testid="promo-code-row"][data-promo-code="${code}"]`);
        await expect(created).toBeVisible();
        await expect(created).toContainText('Abierto');
        const createdRows = await execSQL<{ id: string }>(
            'SELECT id FROM promo_code WHERE code = $1',
            [code]
        );
        if (!createdRows[0]) throw new Error('Created promo code was not persisted.');
        ownedPromoIds.add(createdRows[0].id);

        const existingCode = `CLOSE${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
        const existingPromoId = await seedPromo(existingCode);
        const redemptionRows = await execSQL<{ id: string }>(
            `INSERT INTO promo_redemption (promo_code_id, user_id, subscription_id, redeemed_at, remaining_charges)
             VALUES ($1, $2, $3, now(), 3) RETURNING id`,
            [existingPromoId, owner.id, subscriptionId]
        );
        const redemptionId = redemptionRows[0]?.id;
        if (!redemptionId) throw new Error('Expected a prior redemption.');
        await page.reload();
        const row = page.locator(
            `[data-testid="promo-code-row"][data-promo-code="${existingCode}"]`
        );
        await row.getByTestId('promo-code-close').click();
        const closeConfirmation = page.getByTestId('promo-code-close-confirmation');
        await expect(closeConfirmation).toContainText('1 redenciones ya hechas siguen igual');
        await closeConfirmation.getByRole('button', { name: 'Cerrar código' }).click();
        await expect(row).toContainText('Cerrado');
        const closed = await execSQL<{ closed_at: Date | null; closed_by: string | null }>(
            'SELECT closed_at, closed_by FROM promo_code WHERE id = $1',
            [existingPromoId]
        );
        expect(closed[0]?.closed_at).not.toBeNull();
        expect(closed[0]?.closed_by).toBe(superAdmin.id);
        const unchanged = await execSQL<{ remaining_charges: number }>(
            'SELECT remaining_charges FROM promo_redemption WHERE id = $1',
            [redemptionId]
        );
        expect(unchanged[0]?.remaining_charges).toBe(3);
        const nextUser = await createUser({}, { apiBaseUrl: API_URL });
        ownedUsers.add(nextUser.id);
        const rejected = await fetch(`${API_URL}/api/v1/protected/billing/promo-codes/redeem`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: nextUser.sessionCookie },
            body: JSON.stringify({ code: existingCode, vertical: 'accommodation' })
        });
        expect(rejected.status).toBe(422);
        expect((await rejected.json()).error.reason).toBe('PROMO_CODE_NOT_AVAILABLE');

        await useAdminSession(page, admin.sessionCookie);
        await page.goto(`${ADMIN_URL}/billing/promo-codes`);
        await expect(page).toHaveURL(/\/auth\/forbidden/);
        const forbidden = await fetch(`${API_URL}/api/v1/admin/billing-promo-codes`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: admin.sessionCookie },
            body: JSON.stringify({
                code,
                effect: {
                    kind: 'DISCOUNT',
                    discountKind: 'PERCENTAGE',
                    value: 20,
                    durationKind: 'N_CHARGES',
                    durationCharges: 3
                },
                allVerticals: true,
                verticals: null,
                totalQuota: null,
                validFrom: new Date().toISOString(),
                validUntil: '2030-12-31T00:00:00.000Z',
                stackable: false,
                usableWithAnotherActive: false
            })
        });
        expect(forbidden.status).toBe(403);
    });
});
