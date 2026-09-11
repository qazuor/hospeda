/**
 * @file CommerceDowngradeKeepPanel.test.tsx
 * @description Tests for the commerce "elegí cuáles conservar" panel (HOS-1122).
 *
 * ## What is worth pinning here
 *
 * This panel is the only thing standing between an owner and a default that
 * decides for them: with no selection, the apply-time cron keeps the
 * most-recently-updated listings and hides the rest. So the assertions are
 * about what the OWNER can see and do, not about what the component declares:
 *
 * 1. Every listing is rendered and reachable by its accessible NAME. The rows
 *    carry a "Sugerida" badge inside the same `<label>` as the checkbox, so a
 *    version that dropped `aria-label` would compute the accessible name from
 *    `textContent` and silently rename every suggested listing to
 *    "<name>Sugerida". `getByRole('checkbox', { name })` is what notices;
 *    `getByLabelText` would not, because it also matches label text.
 * 2. The system's suggestion arrives pre-ticked — that is the whole reason the
 *    preview carries `keepByDefault`.
 * 3. Over-cap blocks Confirm. Submitting more listings than the tier allows
 *    would have the server silently truncate the selection back to the default
 *    band, i.e. quietly ignore the owner's choice.
 * 4. The panel says WHEN, and says the quota consequence. Neither is
 *    decoration: without the date the owner believes they already downgraded,
 *    and without the quota note they believe a hidden listing frees a slot.
 */

import type { CommerceDowngradePreview } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommerceDowngradeKeepPanel } from '@/components/commerce/CommerceDowngradeKeepPanel.client';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        // Echoes WHICH CLDR form was asked for, rather than returning a bare
        // `vi.fn()` (i.e. `undefined`, which threw the moment the component
        // started calling it). The intro is the only plural-resolved string
        // here, and what a test can meaningfully assert about it is that the
        // count picked the right form — not the copy, which lives in the
        // locale files.
        tPlural: (key: string, count: number) => `${key}_${count === 1 ? 'one' : 'other'}`
    })
}));

/** A preview with `activeCount` listings and a cap of `cap`. */
function makePreview(cap: number, activeCount: number): CommerceDowngradePreview {
    return {
        vertical: 'gastronomy',
        cap,
        activeCount,
        excessCount: Math.max(0, activeCount - cap),
        items: Array.from({ length: activeCount }, (_, index) => ({
            id: `00000000-0000-4000-8000-00000000000${index}`,
            name: `Cantina ${index}`,
            updatedAt: new Date(2026, 0, activeCount - index).toISOString(),
            viewCount: null,
            keepByDefault: index < cap
        })),
        hasExcess: activeCount > cap
    };
}

function renderPanel(
    overrides: Partial<React.ComponentProps<typeof CommerceDowngradeKeepPanel>> = {}
) {
    const onConfirm = vi.fn();
    const onBack = vi.fn();
    render(
        <CommerceDowngradeKeepPanel
            preview={makePreview(1, 3)}
            targetPlanName="Gastronomía Básico"
            effectiveDateLabel="1 de octubre de 2026"
            locale="es"
            onConfirm={onConfirm}
            onBack={onBack}
            isPending={false}
            {...overrides}
        />
    );
    return { onConfirm, onBack };
}

describe('CommerceDowngradeKeepPanel (HOS-1122)', () => {
    it('renders one checkbox per listing, named by the listing itself', () => {
        renderPanel();

        expect(screen.getAllByRole('checkbox')).toHaveLength(3);
        expect(screen.getByRole('checkbox', { name: 'Cantina 0' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Cantina 2' })).toBeInTheDocument();
    });

    it('names the SUGGESTED row by its listing alone, badge text excluded', () => {
        // The trap. "Cantina 0" is the only suggested row (cap 1), so its label
        // holds both the name and the "Sugerida" chip. Without `aria-label` the
        // accessible name becomes "Cantina 0Sugerida" and a screen-reader user
        // hears a listing they do not own.
        renderPanel();

        const suggested = screen.getByRole('checkbox', { name: 'Cantina 0' });

        expect(suggested).toBeChecked();
        expect(suggested.getAttribute('aria-label')).toBe('Cantina 0');
        // And the badge really IS inside that row — otherwise this test would
        // be asserting the trap is avoided in a layout that never had it.
        expect(screen.getByText('Sugerida')).toBeInTheDocument();
    });

    it('pre-ticks exactly the tier`s worth of suggestions and nothing else', () => {
        renderPanel({ preview: makePreview(2, 4) });

        expect(screen.getByRole('checkbox', { name: 'Cantina 0' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Cantina 1' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Cantina 2' })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Cantina 3' })).not.toBeChecked();
    });

    it('emits the OWNER`s choice, not the default one', () => {
        const { onConfirm } = renderPanel();

        // Swap the suggestion for a different listing.
        fireEvent.click(screen.getByRole('checkbox', { name: 'Cantina 0' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Cantina 2' }));
        fireEvent.click(screen.getByRole('button', { name: 'Programar el cambio' }));

        expect(onConfirm).toHaveBeenCalledWith({
            listingIds: ['00000000-0000-4000-8000-000000000002']
        });
    });

    it('blocks Confirm while more listings are selected than the tier allows', () => {
        const { onConfirm } = renderPanel();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Cantina 1' }));

        const confirm = screen.getByRole('button', { name: 'Programar el cambio' });
        expect(confirm).toBeDisabled();
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Elegiste 2 y el plan permite 1. Desmarcá 1.'
        );

        fireEvent.click(confirm);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('re-enables Confirm once the selection fits again', () => {
        // The mirror of the case above: a warning that never clears is a
        // different bug with the same first assertion.
        renderPanel();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Cantina 1' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Cantina 1' }));

        expect(screen.getByRole('button', { name: 'Programar el cambio' })).toBeEnabled();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('lets the owner keep FEWER than the cap', () => {
        // Under-selecting is legitimate — an owner may want only one of the
        // three visible. Only over-cap is a refusal.
        const { onConfirm } = renderPanel({ preview: makePreview(2, 4) });

        fireEvent.click(screen.getByRole('checkbox', { name: 'Cantina 1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Programar el cambio' }));

        expect(onConfirm).toHaveBeenCalledWith({
            listingIds: ['00000000-0000-4000-8000-000000000000']
        });
    });

    it('tells the owner WHEN the change starts to apply', () => {
        renderPanel();

        expect(screen.getByText(/El cambio se aplica el 1 de octubre de 2026/)).toBeInTheDocument();
    });

    it('says so in words when the period end is unknown, rather than inventing a date', () => {
        renderPanel({ effectiveDateLabel: null });

        expect(screen.getByText(/al final del período que ya pagaste/)).toBeInTheDocument();
    });

    it('states that a hidden listing keeps occupying its quota slot', () => {
        // Owner-visible copy for a real, un-decided platform behaviour: the
        // restricted listing still counts, so no replacement can be created.
        renderPanel();

        expect(screen.getByText(/sigue ocupando lugar en tu cupo/)).toBeInTheDocument();
    });

    it('asks for the SINGULAR intro when the owner has one active listing', () => {
        // Regression: the intro was one flat key, so a single listing read
        // "de tus 1 fichas" in all three locales. The count that governs the
        // noun is `activeCount`, not the target plan's `cap`.
        renderPanel({ preview: makePreview(0, 1) });

        expect(
            screen.getByText('commerce.owner.planChange.keepPanel.intro_one')
        ).toBeInTheDocument();
    });

    it('asks for the PLURAL intro on more than one, keyed on activeCount not cap', () => {
        // cap === 1 with three listings: were the form resolved from `cap`,
        // this would ask for `_one` while the sentence names three.
        renderPanel({ preview: makePreview(1, 3) });

        expect(
            screen.getByText('commerce.owner.planChange.keepPanel.intro_other')
        ).toBeInTheDocument();
    });

    it('disables everything while the request is in flight', () => {
        renderPanel({ isPending: true });

        expect(screen.getByRole('checkbox', { name: 'Cantina 0' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cargando...' })).toBeDisabled();
    });
});
