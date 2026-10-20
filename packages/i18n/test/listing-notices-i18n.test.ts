/** TEST:V6:5 — surplus and restitution notice copy is present in every locale. */

import { describe, expect, it } from 'vitest';
import enHost from '../src/locales/en/host.json';
import en from '../src/locales/en/listing.json';
import esHost from '../src/locales/es/host.json';
import es from '../src/locales/es/listing.json';
import ptHost from '../src/locales/pt/host.json';
import pt from '../src/locales/pt/listing.json';

const locales = { es, en, pt };
const keys = [
    'surplus.criterion',
    'surplus.recurringFeatured',
    'surplus.noWindowDone',
    'restitution.restored',
    'restitution.notRestored',
    'restitution.criterion',
    'restitution.nothingDeleted'
] as const;

function valueAt(root: typeof es, key: string): string {
    const [group, name] = key.split('.');
    if (group !== 'surplus' && group !== 'restitution') return '';
    return root.notices[group][name as keyof (typeof root.notices)[typeof group]];
}

describe('TEST:V6:5 listing notices i18n', () => {
    it('has all seven non-empty notice strings in es, en and pt', () => {
        for (const locale of Object.values(locales)) {
            for (const key of keys) expect(valueAt(locale, key).trim()).not.toBe('');
        }
    });

    it('states the order in both criteria for all locales', () => {
        expect(es.notices.surplus.criterion).toMatch(/más recientemente/i);
        expect(es.notices.restitution.criterion).toMatch(/primero/i);
        expect(en.notices.surplus.criterion).toMatch(/most recently/i);
        expect(en.notices.restitution.criterion).toMatch(/first/i);
        expect(pt.notices.surplus.criterion).toMatch(/mais recentemente/i);
        expect(pt.notices.restitution.criterion).toMatch(/primeiro/i);
    });
});

/** Reads a dot path under a JSON root; `''` when absent or not a string. */
function at(root: unknown, path: string): string {
    const value = path
        .split('.')
        .reduce<unknown>(
            (node, segment) =>
                node !== null && typeof node === 'object'
                    ? (node as Record<string, unknown>)[segment]
                    : undefined,
            root
        );
    return typeof value === 'string' ? value : '';
}

/** HOS-1492 (V8a.1b): the copy of the owner's listing notices. */
const LISTING_NOTICE_KEYS = [
    'reason',
    'neverReturns',
    'purgedByInactivity.title',
    'purgedByInactivity.body',
    'purgedFromModeration.title',
    'purgedFromModeration.body',
    'purgedFromModeration.what',
    'purged.title',
    'purged.body',
    'archived.title',
    'archived.nothingDeleted',
    'archived.recurring_one',
    'archived.recurring_other',
    'archived.canSeeAndExport',
    'archived.returnsOnItsOwn',
    'archived.backToDraft',
    'archived.deletionDate',
    'moderated.title',
    'moderated.hidden',
    'moderated.canDo',
    'moderated.recurring_one',
    'moderated.recurring_other',
    'fixRequest.title',
    'fixRequest.suggestedDate',
    'fixRequest.stillVisible',
    'fixRequest.button',
    'fixRequest.reported',
    'fixRequest.error',
    'lifted.title',
    'lifted.returnedTo.PUBLISHED',
    'lifted.returnedTo.DRAFT',
    'lifted.returnedTo.UNPUBLISHED_BY_BILLING',
    'lifted.returnedTo.ARCHIVED',
    'lifted.draftIsYours',
    'lifted.fixRequestOpen',
    'surplusTitle'
] as const;

/** HOS-1492: rows 21, 2 and 25 on the accommodation card. */
const HOST_CARD_KEYS = [
    'subscribeToPublish.title',
    'subscribeToPublish.body',
    'subscribeToPublish.vertical.accommodation',
    'subscribeToPublish.vertical.gastronomy',
    'subscribeToPublish.vertical.experience',
    'unpublishTrialNote',
    'unpublishRecurringNote_one',
    'unpublishRecurringNote_other'
] as const;

describe('HOS-1492 listing notices and publish copy i18n', () => {
    it('has every new notice string, non-empty, in es, en and pt', () => {
        for (const locale of Object.values(locales)) {
            for (const key of LISTING_NOTICE_KEYS) {
                expect(at(locale.notices, key).trim(), key).not.toBe('');
            }
        }
    });

    it('has every new card string, non-empty, in es, en and pt', () => {
        for (const host of [esHost, enHost, ptHost]) {
            for (const key of HOST_CARD_KEYS) {
                expect(at(host.properties.card, key).trim(), key).not.toBe('');
            }
        }
    });

    it('keeps the placeholders the surfaces interpolate', () => {
        for (const locale of Object.values(locales)) {
            expect(at(locale.notices, 'archived.deletionDate')).toContain('{{date}}');
            expect(at(locale.notices, 'fixRequest.reported')).toContain('{{date}}');
            expect(at(locale.notices, 'reason')).toContain('{{reason}}');
        }
        for (const host of [esHost, enHost, ptHost]) {
            expect(at(host.properties.card, 'subscribeToPublish.body')).toContain('{{vertical}}');
        }
    });

    it('says the literal rows of the spec in Spanish (rows 20 and 21)', () => {
        expect(at(es.notices, 'purgedByInactivity.body')).toMatch(/existió.*inactividad/);
        expect(at(esHost.properties.card, 'subscribeToPublish.title')).toBe(
            'Suscribite para publicar'
        );
        expect(at(es.notices, 'purgedFromModeration.body')).not.toMatch(/inactividad/);
    });
});
