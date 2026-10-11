/** TEST:V6:5 — surplus and restitution notice copy is present in every locale. */

import { describe, expect, it } from 'vitest';
import en from '../src/locales/en/listing.json';
import es from '../src/locales/es/listing.json';
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
