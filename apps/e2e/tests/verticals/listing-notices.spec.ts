/**
 * TEST:V8a:5 (AC:V8a:4) and TEST:V8a:7 (AC:V8a:6) — e2e web, HOS-1492 (V8a.1b).
 *
 * What the owner's surfaces say, one case per non-Partner row of `V/19` §4 that
 * this piece shows: Mi Cuenta over a listing deleted for inactivity (row 20),
 * "subscribe to publish" when publishing needs a subscription (row 21), the
 * unpublish confirmation under a running trial (row 2), surplus (8/9), archive
 * (18), moderation (24), fix request and lifted moderation (30), deletion of a
 * moderated listing (31), the tourist's thread on an unpublished listing (35)
 * and the accumulated trial days in Mi Suscripción (4).
 *
 * Not here (H12): row 1 (the pricing is empty until HOS-1621: component test),
 * row 19 and the text of every mail (renderer tests), and row 25 — a recurring
 * LISTING add-on makes `coverage()` throw until V6.13 registers `ficha`
 * (`unregisteredListingQuery`), so the e2e environment cannot seed its source.
 *
 * Every case uses its own users and listings and never retires the global plan
 * catalog, so it can run beside the other `@verticals` specs. Not `@p0`.
 */

import { expect, type Page, test } from '@playwright/test';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    attachSession,
    cleanupListingNoticeRows,
    expireAccommodationTrial,
    extendAccommodationTrialBySupport,
    moderateListing,
    purgeOwnListing,
    readPublicationStatus,
    renameListing,
    seedArchived,
    seedConversation,
    seedPurgedByInactivity,
    seedSurplusUnpublish
} from '../../fixtures/listing-notices.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

/** The spec's users and listings, cleaned after each test. */
const created = { userIds: [] as string[], listingIds: [] as string[] };

/** A HOST with a completed profile and the fixtures' active accommodation trial. */
async function createOwner(): Promise<{ readonly id: string; readonly sessionCookie: string }> {
    const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
    created.userIds.push(owner.id);
    await markProfileCompleted({ userId: owner.id });
    return owner;
}

/** A SUPER_ADMIN for the real moderation route (molde `adm-07`). */
async function createAdmin(): Promise<{ readonly sessionCookie: string }> {
    const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
    created.userIds.push(admin.id);
    return admin;
}

/** An owner's listing with a unique name, so its card can be found. */
async function createListing(input: {
    readonly ownerId: string;
    readonly name: string;
    readonly published?: boolean;
}): Promise<string> {
    const listing = await createAccommodation({
        ownerId: input.ownerId,
        slugPrefix: 'v8a-notices',
        lifecycleState: input.published ? 'ACTIVE' : 'DRAFT'
    });
    created.listingIds.push(listing.id);
    await renameListing({ listingId: listing.id, name: input.name });
    return listing.id;
}

/** Opens Mis propiedades as the owner and returns the card of `name`. */
async function openPropertyCard(input: {
    readonly page: Page;
    readonly sessionCookie: string;
    readonly name: string;
}) {
    await seedCookieConsent(input.page);
    await attachSession({ page: input.page, sessionCookie: input.sessionCookie });
    await input.page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
    const list = input.page.getByRole('list', { name: 'Mis propiedades' });
    const card = list.getByRole('listitem').filter({ hasText: input.name });
    await expect(card).toHaveCount(1);
    return card;
}

/** A unique listing name for this run. */
function uniqueName(label: string): string {
    return `V8a ${label} ${Date.now().toString(36)}`;
}

test.describe('Listing notices of V8a @verticals', () => {
    test.afterEach(async () => {
        const userIds = [...created.userIds];
        const listingIds = [...created.listingIds];
        created.userIds.length = 0;
        created.listingIds.length = 0;
        try {
            await cleanupListingNoticeRows({ userIds, listingIds });
        } finally {
            await cleanupTestUsers(getDbPool(), userIds);
        }
    });

    test('TEST:V8a:5 row 20: Mi Cuenta says the listing existed and its content was deleted for inactivity', async ({
        page
    }) => {
        // Arrange
        const owner = await createOwner();
        const name = uniqueName('inactiva');
        const listingId = await createListing({ ownerId: owner.id, name });
        await seedPurgedByInactivity({ listingId });

        // Act
        const card = await openPropertyCard({ page, sessionCookie: owner.sessionCookie, name });

        // Assert
        const notice = card.locator('[data-testid="listing-notice"]');
        await expect(notice).toHaveCount(1);
        await expect(notice).toHaveAttribute('data-notice-kind', 'PURGED_BY_INACTIVITY');
        await expect(notice).toContainText('Ficha borrada por inactividad');
        await expect(notice).toContainText(
            'Esta ficha existió, y su contenido se borró por inactividad.'
        );
        expect(await readPublicationStatus({ listingId })).toBe('PURGED');
    });

    test('TEST:V8a:5 row 21: a spent-trial owner reads "Suscribite para publicar" and the listing stays a draft', async ({
        page
    }) => {
        // Arrange
        const owner = await createOwner();
        const name = uniqueName('sin cobertura');
        const listingId = await createListing({ ownerId: owner.id, name });
        await expireAccommodationTrial({ ownerId: owner.id });

        // Act
        const card = await openPropertyCard({ page, sessionCookie: owner.sessionCookie, name });

        // Assert
        const notice = card.getByTestId('publish-subscribe-to-publish');
        await expect(notice).toBeVisible();
        await expect(notice).toContainText('Suscribite para publicar');
        await expect(notice).toContainText(
            'Tu ficha sigue sin publicar. Para publicarla necesitás una suscripción de alojamiento.'
        );
        await expect(
            card.getByRole('link', { name: 'Elegir plan de anfitrión', exact: true })
        ).toBeVisible();
        await expect(card.getByRole('button', { name: 'Publicar', exact: true })).toHaveCount(0);
        expect(await readPublicationStatus({ listingId })).toBe('DRAFT');
        const trials = await execSQL<{ status: string }>(
            "SELECT status FROM trial WHERE user_id = $1 AND vertical = 'accommodation'",
            [owner.id]
        );
        expect(trials).toEqual([{ status: 'TRIAL_EXPIRED' }]);
    });

    test('TEST:V8a:7 row 2: unpublishing during the trial warns that the trial clock keeps running', async ({
        page
    }) => {
        // Arrange
        const owner = await createOwner();
        const name = uniqueName('en trial');
        const listingId = await createListing({ ownerId: owner.id, name, published: true });
        const card = await openPropertyCard({ page, sessionCookie: owner.sessionCookie, name });

        // Act
        await card.getByRole('button', { name: 'Despublicar', exact: true }).click();

        // Assert
        await expect(card.getByTestId('unpublish-trial-note')).toHaveText(
            'La prueba gratis sigue corriendo: despublicar no detiene el reloj del trial.'
        );
        // Row 25 has no seedable source in e2e (see the header): no recurring line.
        await expect(card.getByTestId('unpublish-recurring-note')).toHaveCount(0);
        await card.getByRole('button', { name: 'Cancelar', exact: true }).click();
        expect(await readPublicationStatus({ listingId })).toBe('PUBLISHED');
    });

    test('TEST:V8a:7 rows 8 and 9: a listing lowered by the quota says the criterion and that there was no window', async ({
        page
    }) => {
        // Arrange: the owner is covered (running trial) and the listing sits out by quota.
        const owner = await createOwner();
        const name = uniqueName('excedente');
        const listingId = await createListing({ ownerId: owner.id, name, published: true });
        await seedSurplusUnpublish({ listingId });

        // Act
        const card = await openPropertyCard({ page, sessionCookie: owner.sessionCookie, name });

        // Assert
        const notice = card.locator('[data-notice-kind="SURPLUS"]');
        await expect(notice).toContainText('Ficha despublicada por el límite de tu plan');
        await expect(notice).toContainText(
            'Se despublican primero las fichas publicadas más recientemente, hasta respetar el límite de tu plan. No se borra nada.'
        );
        await expect(notice).toContainText(
            'No hubo ventana de gracia: se despublicaron primero las fichas más recientes; no simulamos una ventana.'
        );
        await expect(notice).not.toContainText('destaques recurrentes');
        expect(await readPublicationStatus({ listingId })).toBe('UNPUBLISHED_BY_BILLING');
    });

    test('TEST:V8a:7 row 18: an archived listing says nothing was deleted, the deletion date and, only after PB4, that it returns on its own', async ({
        page
    }) => {
        // Arrange
        const owner = await createOwner();
        const byQuota = uniqueName('archivada PB4');
        const byOwner = uniqueName('archivada PB5');
        const byQuotaId = await createListing({
            ownerId: owner.id,
            name: byQuota,
            published: true
        });
        const byOwnerId = await createListing({ ownerId: owner.id, name: byOwner });
        await seedArchived({
            listingId: byQuotaId,
            origin: 'PUBLISHED',
            ownerId: null,
            deletionAnnouncedAt: new Date('2027-03-15T15:00:00.000Z')
        });
        await seedArchived({
            listingId: byOwnerId,
            origin: 'DRAFT',
            ownerId: owner.id,
            deletionAnnouncedAt: new Date('2027-04-10T15:00:00.000Z')
        });

        // Act
        const pb4Card = await openPropertyCard({
            page,
            sessionCookie: owner.sessionCookie,
            name: byQuota
        });
        const pb5Card = page
            .getByRole('list', { name: 'Mis propiedades' })
            .getByRole('listitem')
            .filter({ hasText: byOwner });

        // Assert: PB4
        const pb4 = pb4Card.locator('[data-notice-kind="ARCHIVED"]');
        await expect(pb4).toContainText('Ficha archivada');
        await expect(pb4).toContainText(
            'No se borró nada: la ficha está archivada y no se ve en el sitio.'
        );
        await expect(pb4).toContainText('La seguís viendo y podés exportarla.');
        await expect(pb4).toContainText(
            'Vuelve sola cuando recuperes la cobertura, o cuando el cupo vuelva a alcanzar, si hay lugar para ella.'
        );
        await expect(pb4).toContainText('Podés traerla a borrador cuando quieras, sin pagar.');
        await expect(pb4).toContainText(
            'Si sigue archivada, su contenido se borra a partir del 15 de marzo de 2027.'
        );
        // Assert: PB5 does not return on its own
        const pb5 = pb5Card.locator('[data-notice-kind="ARCHIVED"]');
        await expect(pb5).toContainText('Podés traerla a borrador cuando quieras, sin pagar.');
        await expect(pb5).toContainText('a partir del 10 de abril de 2027.');
        await expect(pb5).not.toContainText('Vuelve sola');
        expect(await readPublicationStatus({ listingId: byQuotaId })).toBe('ARCHIVED');
        expect(await readPublicationStatus({ listingId: byOwnerId })).toBe('ARCHIVED');
    });

    test('TEST:V8a:7 row 24: a moderated listing says the reason, that it is hidden and what the owner can do', async ({
        page
    }) => {
        // Arrange
        const owner = await createOwner();
        const admin = await createAdmin();
        const name = uniqueName('moderada');
        const listingId = await createListing({ ownerId: owner.id, name, published: true });
        await moderateListing({
            adminCookie: admin.sessionCookie,
            listingId,
            body: { action: 'TAKE_DOWN', reason: 'Fotos de otro alojamiento' }
        });

        // Act
        const card = await openPropertyCard({ page, sessionCookie: owner.sessionCookie, name });

        // Assert
        const notice = card.locator('[data-notice-kind="MODERATED"]');
        await expect(notice).toContainText('Ficha moderada');
        await expect(notice).toContainText('Motivo: Fotos de otro alojamiento');
        await expect(notice).toContainText(
            'No se ve en el sitio hasta que un admin levante la moderación.'
        );
        await expect(notice).toContainText(
            'Mientras tanto podés verla, exportarla, editarla y borrarla, pero no publicarla.'
        );
        expect(await readPublicationStatus({ listingId })).toBe('MODERATED');
    });

    test('TEST:V8a:7 row 30: a fix request says the reason and date, and "Ya lo corregí" records the report', async ({
        page
    }) => {
        // Arrange
        const owner = await createOwner();
        const admin = await createAdmin();
        const name = uniqueName('pedido');
        const listingId = await createListing({ ownerId: owner.id, name, published: true });
        await moderateListing({
            adminCookie: admin.sessionCookie,
            listingId,
            body: {
                action: 'REQUEST_FIX',
                reason: 'Falta el horario de ingreso',
                suggestedDate: '2027-01-20'
            }
        });
        const card = await openPropertyCard({ page, sessionCookie: owner.sessionCookie, name });
        const notice = card.locator('[data-notice-kind="FIX_REQUESTED"]');
        await expect(notice).toContainText('Te pidieron un arreglo en esta ficha');
        await expect(notice).toContainText('Motivo: Falta el horario de ingreso');
        await expect(notice).toContainText('Fecha sugerida para corregirlo: 20 de enero de 2027.');
        await expect(notice).toContainText('Tu ficha sigue a la vista mientras tanto.');

        // Act
        await notice.getByRole('button', { name: 'Ya lo corregí', exact: true }).click();

        // Assert
        await expect(notice.getByTestId('report-fixed-done')).toContainText(
            'Avisaste que lo corregiste el'
        );
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ reported: boolean; closed: boolean }>(
                            `SELECT owner_reported_fixed_at IS NOT NULL AS reported,
                                    closed_at IS NOT NULL AS closed
                               FROM fix_request WHERE entity_type = 'accommodation' AND entity_id = $1`,
                            [listingId]
                        )
                    )[0],
                { timeout: 15_000 }
            )
            .toEqual({ reported: true, closed: false });
        expect(await readPublicationStatus({ listingId })).toBe('PUBLISHED');
    });

    test('TEST:V8a:7 row 30: a lifted moderation says where the listing went and that the fix request stays open', async ({
        page
    }) => {
        // Arrange: a draft with a fix request, taken down, lifted keeping the request.
        const owner = await createOwner();
        const admin = await createAdmin();
        const name = uniqueName('levantada');
        const listingId = await createListing({ ownerId: owner.id, name });
        for (const body of [
            { action: 'REQUEST_FIX', reason: 'Corregí la dirección' },
            { action: 'TAKE_DOWN', reason: 'Dirección falsa' },
            { action: 'LIFT', reason: 'Ya está bien', keepFixRequest: true }
        ] as const) {
            await moderateListing({ adminCookie: admin.sessionCookie, listingId, body });
        }

        // Act
        const card = await openPropertyCard({ page, sessionCookie: owner.sessionCookie, name });

        // Assert
        const notice = card.locator('[data-notice-kind="MODERATION_LIFTED"]');
        await expect(notice).toContainText('Se levantó la moderación');
        await expect(notice).toContainText('Volvió a borrador.');
        await expect(notice).toContainText('Publicarla es decisión tuya.');
        await expect(notice).toContainText('El pedido de arreglo sigue abierto.');
        await expect(card.locator('[data-notice-kind="FIX_REQUESTED"]')).toContainText(
            'Motivo: Corregí la dirección'
        );
        expect(await readPublicationStatus({ listingId })).toBe('DRAFT');
    });

    test('TEST:V8a:7 row 31: a moderated listing the owner deletes says what was deleted and that it never returns', async ({
        page
    }) => {
        // Arrange
        const owner = await createOwner();
        const admin = await createAdmin();
        const name = uniqueName('borrada moderada');
        const listingId = await createListing({ ownerId: owner.id, name, published: true });
        await moderateListing({
            adminCookie: admin.sessionCookie,
            listingId,
            body: { action: 'TAKE_DOWN', reason: 'Contenido engañoso' }
        });
        await purgeOwnListing({ ownerCookie: owner.sessionCookie, listingId });

        // Act
        const card = await openPropertyCard({ page, sessionCookie: owner.sessionCookie, name });

        // Assert
        const notice = card.locator('[data-testid="listing-notice"]');
        await expect(notice).toHaveCount(1);
        await expect(notice).toHaveAttribute('data-notice-kind', 'PURGED_FROM_MODERATION');
        await expect(notice).toContainText('Esta ficha se borró mientras estaba moderada.');
        await expect(notice).toContainText(
            'Se borraron sus textos, sus fotos, sus preguntas frecuentes y sus horarios.'
        );
        await expect(notice).toContainText('No vuelve: el borrado es definitivo.');
        await expect(notice).not.toContainText('inactividad');
        expect(await readPublicationStatus({ listingId })).toBe('PURGED');
    });

    test('TEST:V8a:7 row 35: the tourist thread of an unpublished listing is read-only and says no reason', async ({
        page
    }) => {
        // Arrange
        const owner = await createOwner();
        const tourist = await createUser({}, { apiBaseUrl: API_URL });
        created.userIds.push(tourist.id);
        await markProfileCompleted({ userId: tourist.id });
        const listingId = await createListing({
            ownerId: owner.id,
            name: uniqueName('despublicada'),
            published: true
        });
        const { conversationId } = await seedConversation({
            guestId: tourist.id,
            ownerId: owner.id,
            listingId,
            guestBody: '¿Tienen cochera?',
            ownerBody: 'Sí, techada.'
        });
        await execSQL(
            `UPDATE accommodations
                SET publication_status = 'DRAFT', lifecycle_state = 'DRAFT'
              WHERE id = $1`,
            [listingId]
        );

        // Act
        await seedCookieConsent(page);
        await attachSession({ page, sessionCookie: tourist.sessionCookie });
        await page.goto(`${WEB_URL}/es/mi-cuenta/consultas/${conversationId}/`);

        // Assert
        const notice = page.getByTestId('listing-gone-notice');
        await expect(notice).toHaveText('Por ahora no podés mandar mensajes sobre esta ficha.');
        await expect(notice).toHaveAttribute('data-listing-availability', 'NOT_PUBLISHED');
        for (const word of ['borrador', 'archiv', 'moderad', 'suscrip']) {
            await expect(notice).not.toContainText(word);
        }
        await expect(page.getByText('¿Tienen cochera?')).toBeVisible();
        await expect(page.getByText('Sí, techada.')).toBeVisible();
        await expect(page.locator('#reply-body')).toHaveCount(0);
        expect(await readPublicationStatus({ listingId })).toBe('DRAFT');
    });

    test('TEST:V8a:7 row 4: Mi Suscripción shows the accumulated trial days and where they came from', async ({
        page
    }) => {
        // Arrange
        const owner = await createOwner();
        await createListing({ ownerId: owner.id, name: uniqueName('trial extendido') });
        const { totalDays } = await extendAccommodationTrialBySupport({
            ownerId: owner.id,
            days: 7
        });
        const baseDays = totalDays - 7;
        expect(baseDays).toBeGreaterThan(0);

        // Act
        await seedCookieConsent(page);
        await attachSession({ page, sessionCookie: owner.sessionCookie });
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);

        // Assert
        const main = page.locator('main');
        await expect(main).toContainText('Tu prueba gratis de alojamiento');
        await expect(main).toContainText(`${totalDays} días de prueba en total`);
        await expect(main).toContainText(`${baseDays} del plan`);
        await expect(main).toContainText('7 regalados por soporte');
        await expect(main).not.toContainText('por promociones');
    });
});
