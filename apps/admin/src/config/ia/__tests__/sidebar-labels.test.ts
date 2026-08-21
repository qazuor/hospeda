/**
 * Sidebar label tests (HOS-618).
 *
 * The production smoke of 18-19/08 read four navigation entries in English
 * inside an otherwise Spanish panel: "Sponsorships", "Sponsorships activos",
 * "Sponsors (entidad)" and "Webhook events". None of them was a missing
 * translation — `sidebars.ts` declares its label per locale inline, and the
 * `es` value had simply been typed in English.
 *
 * These tests assert two different things:
 *   1. A regression pin on those four entries, so reverting the wording fails.
 *   2. A general invariant that every navigation entry, in every sidebar,
 *      carries a non-empty label in all three locales — which is what stops the
 *      next entry from shipping with one of them blank.
 *
 * @see apps/admin/src/config/ia/sidebars.ts — subject under test
 */

import { describe, expect, it } from 'vitest';
import { sidebars } from '../sidebars';

type LabelledItem = {
    readonly type: string;
    readonly id: string;
    readonly label?: { es?: string; en?: string; pt?: string };
    readonly items?: readonly LabelledItem[];
};

/**
 * Flattens every labelled navigation entry across every sidebar.
 *
 * Descends into groups so a new nested entry is covered without touching this
 * file. Separators carry no label by design and are skipped.
 *
 * @returns Every `link` and `group` item, from every registered sidebar.
 */
function allLabelledItems(): LabelledItem[] {
    const out: LabelledItem[] = [];
    const walk = (items: readonly LabelledItem[]): void => {
        for (const item of items) {
            if (item.type === 'separator') continue;
            out.push(item);
            if (item.items) walk(item.items);
        }
    };
    for (const sidebar of Object.values(sidebars as Record<string, { items: LabelledItem[] }>)) {
        walk(sidebar.items);
    }
    return out;
}

/**
 * Finds one navigation entry by its id.
 *
 * @param id - The entry's `id` in the IA config.
 * @returns The entry, or undefined when no sidebar declares it.
 */
function itemById(id: string): LabelledItem | undefined {
    return allLabelledItems().find((item) => item.id === id);
}

describe('sidebar labels are written in the locale they claim (HOS-618)', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
        ['sponsorships', 'Patrocinios'],
        ['sponsorships-list', 'Patrocinios activos'],
        ['sponsors', 'Patrocinadores (entidad)'],
        ['webhook-events', 'Eventos de webhook']
    ];

    for (const [id, expected] of cases) {
        it(`${id} carries its Spanish label, not the English one`, () => {
            const item = itemById(id);
            expect(item, `no sidebar declares an item with id "${id}"`).toBeDefined();
            expect(item?.label?.es).toBe(expected);
        });
    }

    it('webhook-events is Portuguese in pt, not English carried over', () => {
        expect(itemById('webhook-events')?.label?.pt).toBe('Eventos de webhook');
    });
});

describe('every navigation entry is labelled in all three locales', () => {
    it('finds entries to check, so the invariant below cannot pass vacuously', () => {
        expect(allLabelledItems().length).toBeGreaterThan(20);
    });

    it('leaves no entry without a Spanish, English and Portuguese label', () => {
        const incomplete = allLabelledItems()
            .filter(
                (item) =>
                    !item.label?.es?.trim() || !item.label?.en?.trim() || !item.label?.pt?.trim()
            )
            .map((item) => item.id);
        expect(incomplete).toEqual([]);
    });
});
