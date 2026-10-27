/**
 * @file listing-notices.test.ts
 * @description The owner's listing notices (HOS-1492, V8a.1b): one view per
 * `kind` with the REAL Spanish copy of its `V/19` §4 row, and the absence of
 * that copy in every other kind (TEST:V8a:5 for rows 20 and 21, TEST:V8a:7 for
 * rows 2, 8/9, 18, 24, 25, 30 and 31, at the component level).
 */

import type { ListingNotice, ListingNoticesItem } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '@/lib/i18n';
import {
    buildListingNoticeViews,
    buildSubscribeToPublishCopy,
    buildUnpublishConfirmNotes,
    EMPTY_LISTING_NOTICES_INDEX,
    indexListingNotices
} from '@/lib/listing/listing-notices';

const es = createTranslations('es');
const LISTING_ID = '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11';

function item(notice: ListingNotice, recurringListingAddons = 0): ListingNoticesItem {
    return {
        listingId: LISTING_ID,
        publicationStatus: 'PURGED' as ListingNoticesItem['publicationStatus'],
        recurringListingAddons,
        notices: [notice]
    };
}

function textOf(notice: ListingNotice, recurringListingAddons = 0): string {
    const views = buildListingNoticeViews({
        locale: 'es',
        t: es.t,
        tPlural: es.tPlural,
        item: item(notice, recurringListingAddons)
    });
    return views.map((view) => [view.title, ...view.lines].join('\n')).join('\n');
}

const ALL_NOTICES: readonly ListingNotice[] = [
    { kind: 'PURGED_BY_INACTIVITY' },
    { kind: 'PURGED_FROM_MODERATION' },
    { kind: 'PURGED' },
    { kind: 'ARCHIVED', deletionAnnouncedAt: '2027-01-08T02:00:00.000Z', returnsOnItsOwn: true },
    { kind: 'MODERATED', reason: 'Fotos ajenas', since: '2026-10-01T12:00:00.000Z' },
    {
        kind: 'FIX_REQUESTED',
        reason: 'Horario incorrecto',
        suggestedDate: '2026-10-20',
        openedAt: '2026-10-10T12:00:00.000Z',
        ownerReportedFixedAt: null
    },
    {
        kind: 'MODERATION_LIFTED',
        returnedTo: 'DRAFT' as Extract<ListingNotice, { kind: 'MODERATION_LIFTED' }>['returnedTo'],
        at: '2026-10-10T12:00:00.000Z',
        fixRequestOpen: false
    },
    { kind: 'SURPLUS' }
];

/** Every kind except the one under test. */
function othersThan(kind: ListingNotice['kind']): readonly ListingNotice[] {
    return ALL_NOTICES.filter((notice) => notice.kind !== kind);
}

describe('buildListingNoticeViews — one view per kind (HOS-1492)', () => {
    it('TEST:V8a:5 row 20: the listing existed and its content was deleted for inactivity', () => {
        // Act
        const text = textOf({ kind: 'PURGED_BY_INACTIVITY' });

        // Assert
        expect(text).toContain('Esta ficha existió, y su contenido se borró por inactividad.');
        for (const other of othersThan('PURGED_BY_INACTIVITY')) {
            expect(textOf(other)).not.toMatch(/inactividad/);
        }
    });

    it('TEST:V8a:7 row 31: deleted, what was deleted, never returns, and NOT inactivity', () => {
        // Act
        const text = textOf({ kind: 'PURGED_FROM_MODERATION' });

        // Assert
        expect(text).toContain('Esta ficha se borró mientras estaba moderada.');
        expect(text).toContain('Se borraron sus textos, sus fotos');
        expect(text).toContain('No vuelve: el borrado es definitivo.');
        expect(text).not.toMatch(/inactividad|existió/);
        for (const other of othersThan('PURGED_FROM_MODERATION')) {
            expect(textOf(other)).not.toContain('Se borraron sus textos');
        }
    });

    it('a common PB12: deleted and never returns, with no reason and no inventory', () => {
        // Act
        const text = textOf({ kind: 'PURGED' });

        // Assert
        expect(text).toContain('Esta ficha se borró.');
        expect(text).toContain('No vuelve: el borrado es definitivo.');
        expect(text).not.toMatch(/inactividad|moderada|Se borraron sus textos/);
    });

    it('TEST:V8a:7 row 18 (PB4): nothing deleted, recurring boosts, export, returns on its own with the criterion, draft, date', () => {
        // Act
        const text = textOf(
            {
                kind: 'ARCHIVED',
                deletionAnnouncedAt: '2027-01-08T02:00:00.000Z',
                returnsOnItsOwn: true
            },
            2
        );

        // Assert
        expect(text).toContain('No se borró nada');
        expect(text).toContain(
            'Tenés 2 destaques recurrentes sobre esta ficha: se siguen cobrando aunque esté archivada, hasta que los des de baja.'
        );
        expect(text).toContain('La seguís viendo y podés exportarla.');
        expect(text).toContain('Vuelve sola cuando recuperes la cobertura');
        expect(text).toContain('Vuelve primero la ficha que cayó al final');
        expect(text).toContain('Podés traerla a borrador cuando quieras, sin pagar.');
        // 2027-01-08T02:00Z is still January 7 in Argentina.
        expect(text).toContain('se borra a partir del 7 de enero de 2027');
        for (const other of othersThan('ARCHIVED')) {
            expect(textOf(other)).not.toContain('Podés traerla a borrador');
        }
    });

    it('TEST:V8a:7 row 18 (PB5): a draft does not return on its own and has no criterion; no boosts line without boosts', () => {
        // Act
        const text = textOf({
            kind: 'ARCHIVED',
            deletionAnnouncedAt: null,
            returnsOnItsOwn: false
        });

        // Assert
        expect(text).toContain('No se borró nada');
        expect(text).not.toContain('Vuelve sola');
        expect(text).not.toContain('Vuelve primero');
        expect(text).not.toContain('destaque');
        expect(text).not.toContain('se borra a partir');
    });

    it('TEST:V8a:7 row 24: reason, hidden until lifted, what can be done, recurring boosts', () => {
        // Act
        const text = textOf(
            { kind: 'MODERATED', reason: 'Fotos ajenas', since: '2026-10-01T12:00:00.000Z' },
            1
        );

        // Assert
        expect(text).toContain('Motivo: Fotos ajenas');
        expect(text).toContain('No se ve en el sitio hasta que un admin levante la moderación.');
        expect(text).toContain(
            'Mientras tanto podés verla, exportarla, editarla y borrarla, pero no publicarla.'
        );
        expect(text).toContain(
            'Tenés 1 destaque recurrente sobre esta ficha: se sigue cobrando hasta que lo des de baja.'
        );
        for (const other of othersThan('MODERATED')) {
            expect(textOf(other)).not.toContain('levante la moderación');
        }
    });

    it('row 24 without a recorded reason does not invent one', () => {
        // Act
        const text = textOf({ kind: 'MODERATED', reason: null, since: null });

        // Assert
        expect(text).not.toContain('Motivo');
        expect(text).toContain('No se ve en el sitio');
    });

    it('TEST:V8a:7 row 30 (request): reason, suggested date, still visible, and the button', () => {
        // Act
        const views = buildListingNoticeViews({
            locale: 'es',
            t: es.t,
            tPlural: es.tPlural,
            item: item(ALL_NOTICES[5] as ListingNotice)
        });
        const text = textOf(ALL_NOTICES[5] as ListingNotice);

        // Assert
        expect(text).toContain('Motivo: Horario incorrecto');
        expect(text).toContain('Fecha sugerida para corregirlo: 20 de octubre de 2026.');
        expect(text).toContain('Tu ficha sigue a la vista mientras tanto.');
        expect(views[0]?.reportFixed).toEqual({ reportedAt: null });
        for (const other of othersThan('FIX_REQUESTED')) {
            const otherViews = buildListingNoticeViews({
                locale: 'es',
                t: es.t,
                tPlural: es.tPlural,
                item: item(other)
            });
            expect(otherViews.every((view) => view.reportFixed === null)).toBe(true);
        }
    });

    it('row 30 (request) carries the instant the owner already reported', () => {
        // Act
        const views = buildListingNoticeViews({
            locale: 'es',
            t: es.t,
            tPlural: es.tPlural,
            item: item({
                kind: 'FIX_REQUESTED',
                reason: 'x',
                suggestedDate: null,
                openedAt: '2026-10-10T12:00:00.000Z',
                ownerReportedFixedAt: '2026-10-11T12:00:00.000Z'
            })
        });

        // Assert
        expect(views[0]?.reportFixed).toEqual({ reportedAt: '2026-10-11T12:00:00.000Z' });
        expect(views[0]?.lines.join('\n')).not.toContain('Fecha sugerida');
    });

    it('TEST:V8a:7 row 30 (lift to draft): where it went and that publishing is theirs', () => {
        // Act
        const text = textOf(ALL_NOTICES[6] as ListingNotice);

        // Assert
        expect(text).toContain('Volvió a borrador.');
        expect(text).toContain('Publicarla es decisión tuya.');
        for (const other of othersThan('MODERATION_LIFTED')) {
            expect(textOf(other)).not.toContain('Publicarla es decisión tuya.');
        }
    });

    it('row 30 (lift to published, request still open): no "publishing is yours"', () => {
        // Act
        const text = textOf({
            kind: 'MODERATION_LIFTED',
            returnedTo: 'PUBLISHED' as Extract<
                ListingNotice,
                { kind: 'MODERATION_LIFTED' }
            >['returnedTo'],
            at: '2026-10-10T12:00:00.000Z',
            fixRequestOpen: true
        });

        // Assert
        expect(text).toContain('Volvió a estar publicada.');
        expect(text).toContain('El pedido de arreglo sigue abierto.');
        expect(text).not.toContain('Publicarla es decisión tuya.');
    });

    it('TEST:V8a:7 rows 8 and 9: the criterion, no window, and the recurring boosts only with boosts', () => {
        // Act
        const withBoosts = textOf({ kind: 'SURPLUS' }, 1);
        const withoutBoosts = textOf({ kind: 'SURPLUS' });

        // Assert
        expect(withBoosts).toContain(
            'Se despublican primero las fichas publicadas más recientemente'
        );
        expect(withBoosts).toContain('liberá lugar en tu cupo');
        expect(withBoosts).toContain(
            'Los destaques recurrentes de las fichas que bajaron se siguen cobrando'
        );
        expect(withBoosts).not.toContain('simulamos');
        expect(withBoosts).not.toContain('ventana');
        expect(withoutBoosts).not.toContain('Los destaques recurrentes');
        for (const other of othersThan('SURPLUS')) {
            expect(textOf(other)).not.toContain('liberá lugar en tu cupo');
        }
    });

    it('renders nothing without the listing entry (a failed read)', () => {
        // Act
        const views = buildListingNoticeViews({
            locale: 'es',
            t: es.t,
            tPlural: es.tPlural,
            item: undefined
        });

        // Assert
        expect(views).toEqual([]);
    });

    it('speaks every locale (en and pt) for row 20', () => {
        // Arrange
        const en = createTranslations('en');
        const pt = createTranslations('pt');

        // Act
        const [enView] = buildListingNoticeViews({
            locale: 'en',
            t: en.t,
            tPlural: en.tPlural,
            item: item({ kind: 'PURGED_BY_INACTIVITY' })
        });
        const [ptView] = buildListingNoticeViews({
            locale: 'pt',
            t: pt.t,
            tPlural: pt.tPlural,
            item: item({ kind: 'PURGED_BY_INACTIVITY' })
        });

        // Assert
        expect(enView?.lines).toEqual([
            'This listing existed, and its content was deleted for inactivity.'
        ]);
        expect(ptView?.lines).toEqual([
            'Este anúncio existiu, e o seu conteúdo foi apagado por inatividade.'
        ]);
    });
});

describe('indexListingNotices — a failed read never invents a notice', () => {
    it('indexes a successful read by listing id', () => {
        // Act
        const index = indexListingNotices({
            result: {
                ok: true,
                data: { trialRunning: true, items: [item({ kind: 'SURPLUS' })] }
            }
        });

        // Assert
        expect(index.ok).toBe(true);
        expect(index.trialRunning).toBe(true);
        expect(index.byListingId.get(LISTING_ID)?.notices).toEqual([{ kind: 'SURPLUS' }]);
    });

    it('a failed read is empty, with an unknown trial', () => {
        // Act
        const index = indexListingNotices({
            result: { ok: false, error: { status: 500, message: 'boom' } }
        });

        // Assert
        expect(index).toBe(EMPTY_LISTING_NOTICES_INDEX);
        expect(index.trialRunning).toBeNull();
        expect(index.byListingId.size).toBe(0);
    });
});

describe('buildUnpublishConfirmNotes — rows 2 and 25', () => {
    it('TEST:V8a:7 row 2: says the trial clock keeps running only while the trial runs', () => {
        // Act
        const running = buildUnpublishConfirmNotes({
            t: es.t,
            tPlural: es.tPlural,
            trialRunning: true,
            item: undefined
        });
        const notRunning = buildUnpublishConfirmNotes({
            t: es.t,
            tPlural: es.tPlural,
            trialRunning: false,
            item: undefined
        });
        const unknown = buildUnpublishConfirmNotes({
            t: es.t,
            tPlural: es.tPlural,
            trialRunning: null,
            item: undefined
        });

        // Assert
        expect(running.trialNote).toBe(
            'La prueba gratis sigue corriendo: despublicar no detiene el reloj del trial.'
        );
        expect(notRunning).toEqual({});
        expect(unknown).toEqual({});
    });

    it('TEST:V8a:7 row 25: the recurring boosts keep being charged while unpublished', () => {
        // Act
        const notes = buildUnpublishConfirmNotes({
            t: es.t,
            tPlural: es.tPlural,
            trialRunning: false,
            item: item({ kind: 'SURPLUS' }, 3)
        });

        // Assert
        expect(notes.recurringNote).toBe(
            'Tenés 3 destaques recurrentes sobre esta ficha: se siguen cobrando aunque no esté publicada, hasta que los des de baja.'
        );
        expect(notes.trialNote).toBeUndefined();
    });
});

describe('buildSubscribeToPublishCopy — row 21', () => {
    it('TEST:V8a:5 row 21: subscribe to publish, still unpublished, a subscription in the vertical', () => {
        // Act
        const copy = buildSubscribeToPublishCopy({ t: es.t, vertical: 'accommodation' });
        const venue = buildSubscribeToPublishCopy({ t: es.t, vertical: 'gastronomy' });

        // Assert
        expect(copy).toEqual({
            title: 'Suscribite para publicar',
            body: 'Tu ficha sigue sin publicar. Para publicarla necesitás una suscripción de alojamiento.'
        });
        expect(venue.body).toContain('una suscripción de gastronomía.');
    });
});
