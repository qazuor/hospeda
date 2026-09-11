/**
 * @file CommerceVenueEventEntryCard.weekdays.test.tsx
 * @description The weekday picker renders TRANSLATED day names after
 * hydration, not raw i18n key text (HOS-1042).
 *
 * ## Why this test exists, and why the guard is not enough
 *
 * The card originally resolved its day names with
 * `t('gastronomy.detail.openingHours.<day>')`. That prefix does NOT ship to the
 * browser — 25 of its 32 keys are named only by `.astro` files rendering
 * server-side — so the lookup worked in SSR and then, on hydration, resolved to
 * `undefined` and fell through to the call site's inline fallback. The owner
 * would have picked a day from a list reading "monday, tuesday, …" in every
 * locale, in a Spanish-first product.
 *
 * `test/lib/i18n-client-namespaces.guard.test.ts` catches the STRUCTURAL half:
 * it proves no island names an unshipped prefix. It cannot prove the labels
 * that replaced the lookup actually render. This does — and it is the
 * difference between "the prefix is declared" and "the user sees a day name",
 * which is the whole failure mode the prefix list warns about in its header.
 *
 * The mocked `t` returns each call's inline FALLBACK, which is what a
 * production browser would render for an unshipped key. So a regression that
 * put the client-side lookup back would make these assertions fail with the
 * bare day key — the exact production symptom, reproduced.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommerceVenueEventEntryCard } from '../../../src/components/commerce/CommerceVenueEventEntryCard.client';
import type { EventDraft } from '../../../src/lib/commerce/venue-event-draft';

vi.mock('../../../src/components/commerce/CommerceVenueEventsManager.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

/** Mirrors production for an UNSHIPPED key: the inline fallback is what renders. */
const t = ((key: string, fallback?: string) => fallback ?? key) as never;

/** The seven labels exactly as `eventos.astro` resolves them for `es`. */
const ES_WEEKDAYS = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado'
] as const;

/** A weekly entry, so the weekday `<select>` is the branch that renders. */
const WEEKLY_ENTRY: EventDraft = {
    title: 'Happy hour',
    description: '',
    recurrence: 'weekly',
    date: '',
    weekday: 4,
    startTime: '18:00',
    endTime: '20:00',
    isActive: true
};

/**
 * Renders the card with the given labels.
 *
 * @param weekdayLabels - The seven resolved day names.
 */
function renderCard(weekdayLabels: readonly string[]) {
    render(
        <CommerceVenueEventEntryCard
            entry={WEEKLY_ENTRY}
            index={0}
            t={t}
            weekdayLabels={weekdayLabels}
            onPatch={vi.fn()}
            onMove={vi.fn()}
            onRemove={vi.fn()}
            onSetRecurrence={vi.fn()}
        />
    );
}

describe('CommerceVenueEventEntryCard — weekday labels (HOS-1042)', () => {
    it('renders the seven translated day names as options', () => {
        // Arrange & Act
        renderCard(ES_WEEKDAYS);

        // Assert — every day, by visible text.
        for (const day of ES_WEEKDAYS) {
            expect(screen.getByRole('option', { name: day })).toBeDefined();
        }
    });

    it('renders NO raw i18n key text and no bare day key', () => {
        // The production symptom, asserted negatively. `monday` is what the
        // unshipped-prefix fallback produced, and `gastronomy.detail` is what a
        // call site with no fallback would have printed.
        // Arrange & Act
        const { container } = { container: document.body };
        renderCard(ES_WEEKDAYS);

        // Assert
        expect(container.textContent).not.toContain('gastronomy.detail');
        expect(container.textContent).not.toContain('openingHours');
        for (const bareKey of ['monday', 'thursday', 'sunday']) {
            expect(container.textContent).not.toContain(bareKey);
        }
    });

    it('maps each label to the Sunday-based index the schema stores', () => {
        // `weekday` is 0=Sunday..6=Saturday (Date#getDay). If the array were
        // ever re-based to Monday-first, the picker would keep LOOKING right
        // and store the wrong day — a bug with no visible symptom in the
        // editor, only on the public page.
        // Arrange & Act
        renderCard(ES_WEEKDAYS);

        // Assert
        expect(screen.getByRole('option', { name: 'Domingo' }).getAttribute('value')).toBe('0');
        expect(screen.getByRole('option', { name: 'Jueves' }).getAttribute('value')).toBe('4');
        expect(screen.getByRole('option', { name: 'Sábado' }).getAttribute('value')).toBe('6');
    });

    it('falls back to the day key only when a label is genuinely missing', () => {
        // The `?? dayKey` guard. A short array must not render `undefined` —
        // that is the one thing worse than an untranslated key.
        // Arrange & Act
        renderCard(['Domingo']);

        // Assert
        expect(screen.getByRole('option', { name: 'Domingo' })).toBeDefined();
        expect(screen.getByRole('option', { name: 'monday' })).toBeDefined();
        expect(document.body.textContent).not.toContain('undefined');
    });
});
