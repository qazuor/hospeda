/** Freeze every vertical write route and its coverage-step decision (AC:V5:9). */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = join(import.meta.dirname, '../../src/routes');
const EXPECTED: Readonly<Record<string, { operation: string } | { exempt: string }>> = {
    'accommodation/admin/addFaq.ts': { operation: 'EDIT' },
    'accommodation/admin/addFeaturedMedia.ts': { operation: 'EDIT' },
    'accommodation/admin/addMedia.ts': { operation: 'EDIT' },
    'accommodation/admin/archiveMedia.ts': { operation: 'EDIT' },
    'accommodation/admin/batch.ts': {
        exempt: 'Lectura por lote (POST que lee por ids, exige *_VIEW_ALL): no escribe.'
    },
    'accommodation/admin/create.ts': {
        exempt: 'Crear una ficha a nombre de su dueño es AC:V8a:7 (V8a.2): el sujeto sale del pedido y la precisión 8 no lo resuelve para un alta (hueco H-10 de notas).'
    },
    'accommodation/admin/delete.ts': {
        exempt: 'Puerta de borrado/restauración del admin que retira V6.7 (AC:V6:25, BD-012); el borrado ajeno a pedido del dueño es ACC:23 (V8a.2, AC:V8a:9).'
    },
    'accommodation/admin/hardDelete.ts': {
        exempt: 'Puerta de borrado/restauración del admin que retira V6.7 (AC:V6:25, BD-012); el borrado ajeno a pedido del dueño es ACC:23 (V8a.2, AC:V8a:9).'
    },
    'accommodation/admin/moderate.ts': {
        exempt: 'ACC:12 (moderar): capacidad del actor, sin pasos 5 a 7 sobre el sujeto (V5.md §3.2 regla 3); la construye V6.5.'
    },
    'accommodation/admin/patch.ts': { operation: 'EDIT' },
    'accommodation/admin/removeFaq.ts': { operation: 'EDIT' },
    'accommodation/admin/removeMedia.ts': { operation: 'EDIT' },
    'accommodation/admin/reorderFaqs.ts': { operation: 'EDIT' },
    'accommodation/admin/reorderMedia.ts': { operation: 'EDIT' },
    'accommodation/admin/restore.ts': {
        exempt: 'Puerta de borrado/restauración del admin que retira V6.7 (AC:V6:25, BD-012); el borrado ajeno a pedido del dueño es ACC:23 (V8a.2, AC:V8a:9).'
    },
    'accommodation/admin/restoreMedia.ts': { operation: 'EDIT' },
    'accommodation/admin/setFeaturedMedia.ts': { operation: 'EDIT' },
    'accommodation/admin/update.ts': { operation: 'EDIT' },
    'accommodation/admin/updateFaq.ts': { operation: 'EDIT' },
    'accommodation/admin/updateMedia.ts': { operation: 'EDIT' },
    'accommodation/admin/verify.ts': {
        exempt: 'Verificación (insignia) del admin: no es contenido del dueño ni una de las 25 acciones (hueco H-11 de notas).'
    },
    'accommodation/protected/addFaq.ts': { operation: 'EDIT' },
    'accommodation/protected/addFeaturedMedia.ts': { operation: 'EDIT' },
    'accommodation/protected/addMedia.ts': { operation: 'EDIT' },
    'accommodation/protected/addOccupancy.ts': { operation: 'EDIT' },
    'accommodation/protected/batchOccupancy.ts': { operation: 'EDIT' },
    'accommodation/protected/calendarConnectGoogle.ts': { operation: 'EDIT' },
    'accommodation/protected/calendarConnectIcal.ts': { operation: 'EDIT' },
    'accommodation/protected/calendarDisconnect.ts': { operation: 'EDIT' },
    'accommodation/protected/calendarSync.ts': { operation: 'EDIT' },
    'accommodation/protected/compare.ts': {
        exempt: 'Comparador del turista (POST de lectura); su gate es AC:V5:28 (V5.13).'
    },
    'accommodation/protected/create.ts': { operation: 'CREATE' },
    'accommodation/protected/createDraft.ts': { operation: 'CREATE' },
    'accommodation/protected/import-from-url.ts': {
        exempt: 'Importación por IA desde una URL; su gate (ai_accommodation_import) es AC:V5:27 (V5.12). VERIFICAR que no persiste una ficha: si la persiste, es CREATE y va con paso.'
    },
    'accommodation/protected/patch.ts': { operation: 'EDIT' },
    'accommodation/protected/publish.ts': { operation: 'PUBLISH' },
    'accommodation/protected/removeFaq.ts': { operation: 'EDIT' },
    'accommodation/protected/removeMedia.ts': { operation: 'EDIT' },
    'accommodation/protected/removeOccupancy.ts': { operation: 'EDIT' },
    'accommodation/protected/reorderFaqs.ts': { operation: 'EDIT' },
    'accommodation/protected/reorderMedia.ts': { operation: 'EDIT' },
    'accommodation/protected/setFeaturedMedia.ts': { operation: 'EDIT' },
    'accommodation/protected/softDelete.ts': { operation: 'DELETE' },
    'accommodation/protected/unpublish.ts': { operation: 'EDIT' },
    'accommodation/protected/update.ts': { operation: 'EDIT' },
    'accommodation/protected/updateFaq.ts': { operation: 'EDIT' },
    'accommodation/protected/updateMedia.ts': { operation: 'EDIT' },
    'accommodation/protected/updateOccupancyEvent.ts': { operation: 'EDIT' },
    'accommodation/reviews/admin/delete.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'accommodation/reviews/admin/hardDelete.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'accommodation/reviews/admin/moderate.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'accommodation/reviews/admin/restore.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'accommodation/reviews/admin/update.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'accommodation/reviews/protected/create.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'experience/admin/addFaq.ts': { operation: 'EDIT' },
    'experience/admin/addFeaturedMedia.ts': { operation: 'EDIT' },
    'experience/admin/addMedia.ts': { operation: 'EDIT' },
    'experience/admin/assignOwner.ts': {
        exempt: 'Fija el dueño: no es ACC:15 ni una de las 25 acciones (hueco H-11 de notas).'
    },
    'experience/admin/batch.ts': {
        exempt: 'Lectura por lote (POST que lee por ids, exige *_VIEW_ALL): no escribe.'
    },
    'experience/admin/create.ts': {
        exempt: 'Crear una ficha a nombre de su dueño es AC:V8a:7 (V8a.2): el sujeto sale del pedido y la precisión 8 no lo resuelve para un alta (hueco H-10 de notas).'
    },
    'experience/admin/delete.ts': {
        exempt: 'Puerta de borrado/restauración del admin que retira V6.7 (AC:V6:25, BD-012); el borrado ajeno a pedido del dueño es ACC:23 (V8a.2, AC:V8a:9).'
    },
    'experience/admin/hardDelete.ts': {
        exempt: 'Puerta de borrado/restauración del admin que retira V6.7 (AC:V6:25, BD-012); el borrado ajeno a pedido del dueño es ACC:23 (V8a.2, AC:V8a:9).'
    },
    'experience/admin/moderate.ts': {
        exempt: 'ACC:12 (moderar): capacidad del actor, sin pasos 5 a 7 sobre el sujeto (V5.md §3.2 regla 3); la construye V6.5.'
    },
    'experience/admin/patch.ts': { operation: 'EDIT' },
    'experience/admin/removeFaq.ts': { operation: 'EDIT' },
    'experience/admin/removeMedia.ts': { operation: 'EDIT' },
    'experience/admin/reorderFaqs.ts': { operation: 'EDIT' },
    'experience/admin/reorderMedia.ts': { operation: 'EDIT' },
    'experience/admin/restore.ts': {
        exempt: 'Puerta de borrado/restauración del admin que retira V6.7 (AC:V6:25, BD-012); el borrado ajeno a pedido del dueño es ACC:23 (V8a.2, AC:V8a:9).'
    },
    'experience/admin/setFeaturedMedia.ts': { operation: 'EDIT' },
    'experience/admin/update.ts': { operation: 'EDIT' },
    'experience/admin/updateFaq.ts': { operation: 'EDIT' },
    'experience/admin/updateMedia.ts': { operation: 'EDIT' },
    'experience/protected/addFaq.ts': { operation: 'EDIT' },
    'experience/protected/addFeaturedMedia.ts': { operation: 'EDIT' },
    'experience/protected/addMedia.ts': { operation: 'EDIT' },
    'experience/protected/certificates.ts': { operation: 'EDIT' },
    'experience/protected/create.ts': { operation: 'CREATE' },
    'experience/protected/createReview.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'experience/protected/deleteDraft.ts': { operation: 'DELETE' },
    'experience/protected/patch.ts': { operation: 'EDIT' },
    'experience/protected/removeFaq.ts': { operation: 'EDIT' },
    'experience/protected/removeMedia.ts': { operation: 'EDIT' },
    'experience/protected/reorderFaqs.ts': { operation: 'EDIT' },
    'experience/protected/reorderMedia.ts': { operation: 'EDIT' },
    'experience/protected/setFeaturedMedia.ts': { operation: 'EDIT' },
    'experience/protected/updateFaq.ts': { operation: 'EDIT' },
    'experience/protected/updateMedia.ts': { operation: 'EDIT' },
    'experience/reviews/admin/delete.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'experience/reviews/admin/moderate.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'experience/reviews/admin/update.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'gastronomy/admin/addFaq.ts': { operation: 'EDIT' },
    'gastronomy/admin/addFeaturedMedia.ts': { operation: 'EDIT' },
    'gastronomy/admin/addMedia.ts': { operation: 'EDIT' },
    'gastronomy/admin/assignOwner.ts': {
        exempt: 'Fija el dueño: no es ACC:15 ni una de las 25 acciones (hueco H-11 de notas).'
    },
    'gastronomy/admin/batch.ts': {
        exempt: 'Lectura por lote (POST que lee por ids, exige *_VIEW_ALL): no escribe.'
    },
    'gastronomy/admin/create.ts': {
        exempt: 'Crear una ficha a nombre de su dueño es AC:V8a:7 (V8a.2): el sujeto sale del pedido y la precisión 8 no lo resuelve para un alta (hueco H-10 de notas).'
    },
    'gastronomy/admin/delete.ts': {
        exempt: 'Puerta de borrado/restauración del admin que retira V6.7 (AC:V6:25, BD-012); el borrado ajeno a pedido del dueño es ACC:23 (V8a.2, AC:V8a:9).'
    },
    'gastronomy/admin/hardDelete.ts': {
        exempt: 'Puerta de borrado/restauración del admin que retira V6.7 (AC:V6:25, BD-012); el borrado ajeno a pedido del dueño es ACC:23 (V8a.2, AC:V8a:9).'
    },
    'gastronomy/admin/moderate.ts': {
        exempt: 'ACC:12 (moderar): capacidad del actor, sin pasos 5 a 7 sobre el sujeto (V5.md §3.2 regla 3); la construye V6.5.'
    },
    'gastronomy/admin/patch.ts': { operation: 'EDIT' },
    'gastronomy/admin/removeFaq.ts': { operation: 'EDIT' },
    'gastronomy/admin/removeMedia.ts': { operation: 'EDIT' },
    'gastronomy/admin/reorderFaqs.ts': { operation: 'EDIT' },
    'gastronomy/admin/reorderMedia.ts': { operation: 'EDIT' },
    'gastronomy/admin/restore.ts': {
        exempt: 'Puerta de borrado/restauración del admin que retira V6.7 (AC:V6:25, BD-012); el borrado ajeno a pedido del dueño es ACC:23 (V8a.2, AC:V8a:9).'
    },
    'gastronomy/admin/setFeaturedMedia.ts': { operation: 'EDIT' },
    'gastronomy/admin/update.ts': { operation: 'EDIT' },
    'gastronomy/admin/updateFaq.ts': { operation: 'EDIT' },
    'gastronomy/admin/updateMedia.ts': { operation: 'EDIT' },
    'gastronomy/protected/addFaq.ts': { operation: 'EDIT' },
    'gastronomy/protected/addFeaturedMedia.ts': { operation: 'EDIT' },
    'gastronomy/protected/addMedia.ts': { operation: 'EDIT' },
    'gastronomy/protected/create.ts': { operation: 'CREATE' },
    'gastronomy/protected/createReview.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'gastronomy/protected/deleteDraft.ts': { operation: 'DELETE' },
    'gastronomy/protected/deleteMenuFile.ts': { operation: 'EDIT' },
    'gastronomy/protected/patch.ts': { operation: 'EDIT' },
    'gastronomy/protected/putDailySpecials.ts': { operation: 'EDIT' },
    'gastronomy/protected/putEvents.ts': { operation: 'EDIT' },
    'gastronomy/protected/putMenu.ts': { operation: 'EDIT' },
    'gastronomy/protected/removeFaq.ts': { operation: 'EDIT' },
    'gastronomy/protected/removeMedia.ts': { operation: 'EDIT' },
    'gastronomy/protected/reorderFaqs.ts': { operation: 'EDIT' },
    'gastronomy/protected/reorderMedia.ts': { operation: 'EDIT' },
    'gastronomy/protected/setFeaturedMedia.ts': { operation: 'EDIT' },
    'gastronomy/protected/updateFaq.ts': { operation: 'EDIT' },
    'gastronomy/protected/updateMedia.ts': { operation: 'EDIT' },
    'gastronomy/protected/uploadMenuFile.ts': { operation: 'EDIT' },
    'gastronomy/protected/uploadMenuItemPhoto.ts': { operation: 'EDIT' },
    'gastronomy/reviews/admin/delete.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'gastronomy/reviews/admin/moderate.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    },
    'gastronomy/reviews/admin/update.ts': {
        exempt: 'Reseña del turista: WRITE_ABOUT_LISTING, el paso 4 ya lo resuelve el servicio (V5.2, AC:V5:25); su gate de plan (write_reviews) es AC:V5:28 (V5.13). No es escritura del dueño sobre su ficha.'
    }
};

function routeFiles(dir: string, prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) return routeFiles(join(dir, entry.name), relative);
        return entry.name.endsWith('.ts') && entry.name !== 'index.ts' ? [relative] : [];
    });
}

const hasWriteMethod = /method:\s*'(?:post|put|patch|delete)'/;
const accessOperation = /^\s*listingAccess:\s*\{[^}]*operation:\s*'(CREATE|EDIT|PUBLISH|DELETE)'/m;

describe('AC:V5:9 TEST:V5:10 coverage step on every vertical write route', () => {
    const actual = ['accommodation', 'gastronomy', 'experience']
        .flatMap((vertical) => routeFiles(join(ROUTES_DIR, vertical), vertical))
        .filter((file) => hasWriteMethod.test(readFileSync(join(ROUTES_DIR, file), 'utf8')))
        .sort();

    it('discovers exactly the frozen 133 route files', () => {
        expect(actual).toEqual(Object.keys(EXPECTED).sort());
        expect(Object.keys(EXPECTED)).toHaveLength(133);
    });

    it('keeps the listingAccess matcher instrumented', () => {
        const known = readFileSync(join(ROUTES_DIR, 'accommodation/admin/addFaq.ts'), 'utf8');
        expect(accessOperation.exec(known)?.[1]).toBe('EDIT');
    });

    it.each(
        Object.entries(EXPECTED)
    )('%s declares its frozen step or exemption', (file, expected) => {
        const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
        const operation = accessOperation.exec(source)?.[1];
        if ('operation' in expected) {
            expect(operation).toBe(expected.operation);
        } else {
            expect(expected.exempt.length).toBeGreaterThan(0);
            expect(operation).toBeUndefined();
        }
    });
});
