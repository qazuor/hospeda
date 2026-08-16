/**
 * @file SearchableSelect.test.tsx
 * @description Regression tests for the async combobox behind the accommodation
 * sign-up city picker (H-136, smoke agosto 2026).
 *
 * This island had no tests at all, which is how the defect below survived.
 *
 * H-136 has two halves. The server half — `ILIKE` being accent-sensitive, so
 * `Colon` never found `Colón` — is fixed in `@repo/db`'s `safeIlike()` and
 * covered by `packages/db/test/integration/accent-insensitive-search.integration.test.ts`.
 *
 * This file covers the client half, which is what turned an annoyance into a
 * dead end: on a zero-result fetch the component ran `setIsOpen(false)`, which
 * hid the whole listbox. Two things live inside that listbox — the "no matches"
 * status and the `footer` slot, where the city picker renders its
 * "No encuentro mi ciudad" recovery link. So the one affordance that could
 * rescue a stuck host disappeared at exactly the moment it was needed, and the
 * only feedback left was a validation error pointing at an empty list.
 *
 * The assertions below are deliberately about what the user can SEE. Asserting
 * that the link is in the DOM would have passed all along — it always was; it
 * was its container that was hidden.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SelectableItem } from '@/components/form/SearchableSelect.client';
import { SearchableSelect } from '@/components/form/SearchableSelect.client';

const CITIES: readonly SelectableItem[] = [
    { id: 'col', label: 'Colón' },
    { id: 'cdu', label: 'Concepción del Uruguay' }
];

const NOT_FOUND_TEXT = 'No encuentro mi ciudad';
const EMPTY_LABEL = 'No hay coincidencias';

/**
 * Renders the picker in async mode with the same shape the sign-up form uses:
 * a `footer` recovery link and a `loadItems` that resolves from a fixed set.
 */
function renderPicker(loadItems: (query: string) => Promise<readonly SelectableItem[]>) {
    return render(
        <SearchableSelect
            locale="es"
            label="Ciudad"
            value={null}
            onChange={vi.fn()}
            loadItems={loadItems}
            minQueryLength={2}
            debounceMs={0}
            emptyLabel={EMPTY_LABEL}
            required
            testId="property-city"
            footer={<a href="/es/contacto/">{NOT_FOUND_TEXT}</a>}
        />
    );
}

/** The listbox is hidden via the `hidden` attribute, so visibility is the assertion. */
function listbox(): HTMLElement {
    return screen.getByTestId('property-city-listbox');
}

describe('SearchableSelect — zero results keep the recovery path reachable (H-136)', () => {
    it('should keep the dropdown visible when the query yields no matches', async () => {
        // Arrange
        const user = userEvent.setup();
        const loadItems = vi.fn().mockResolvedValue([]);
        renderPicker(loadItems);

        // Act
        await user.type(screen.getByLabelText(/Ciudad/), 'Ushuaia');

        // Assert — before the fix the whole listbox carried `hidden`.
        await waitFor(() => expect(loadItems).toHaveBeenCalled());
        await waitFor(() => expect(listbox()).toBeVisible());
    });

    it('should show the empty-state label when the query yields no matches', async () => {
        // Arrange
        const user = userEvent.setup();
        renderPicker(vi.fn().mockResolvedValue([]));

        // Act
        await user.type(screen.getByLabelText(/Ciudad/), 'Ushuaia');

        // Assert — `emptyLabel` was effectively dead code in async mode.
        await waitFor(() => expect(screen.getByText(EMPTY_LABEL)).toBeVisible());
    });

    it('should keep the footer recovery link VISIBLE when there are no matches', async () => {
        // Arrange
        const user = userEvent.setup();
        renderPicker(vi.fn().mockResolvedValue([]));

        // Act
        await user.type(screen.getByLabelText(/Ciudad/), 'Ushuaia');

        // Assert — this is the assertion that matters: the link was always in
        // the DOM, so only a visibility check can fail on the bug.
        await waitFor(() => expect(screen.getByText(NOT_FOUND_TEXT)).toBeVisible());
    });

    it('should keep the footer visible when the fetch itself fails', async () => {
        // Arrange — the component documents the error path as "surface as empty
        // results so the caller can render a recovery action via `footer`".
        // That promise only holds if the panel stays open.
        const user = userEvent.setup();
        renderPicker(vi.fn().mockRejectedValue(new Error('network down')));

        // Act
        await user.type(screen.getByLabelText(/Ciudad/), 'Colon');

        // Assert
        await waitFor(() => expect(screen.getByText(NOT_FOUND_TEXT)).toBeVisible());
    });

    it('should still show matches, and no empty label, when the query resolves', async () => {
        // Arrange — non-regression: keeping the panel open must not break the
        // happy path or leak the empty state alongside real options.
        const user = userEvent.setup();
        renderPicker(vi.fn().mockResolvedValue(CITIES));

        // Act
        await user.type(screen.getByLabelText(/Ciudad/), 'Col');

        // Assert
        await waitFor(() => expect(screen.getByText('Colón')).toBeVisible());
        expect(screen.queryByText(EMPTY_LABEL)).not.toBeInTheDocument();
    });

    it('should keep the dropdown hidden before the minimum query length', async () => {
        // Arrange — non-regression: a single character must not open the panel.
        const user = userEvent.setup();
        const loadItems = vi.fn().mockResolvedValue([]);
        renderPicker(loadItems);

        // Act
        await user.type(screen.getByLabelText(/Ciudad/), 'C');

        // Assert
        expect(loadItems).not.toHaveBeenCalled();
        expect(listbox()).not.toBeVisible();
    });
});
