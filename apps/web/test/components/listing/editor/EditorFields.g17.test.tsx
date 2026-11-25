import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PoliciesPanel } from '@/components/listing/editor/PoliciesPanel.client';
import { PriceSection } from '@/components/listing/editor/PriceSection.client';
import type { ListingPolicyValues } from '@/lib/listing/listing-policies';
import { buildEditData } from './edit-data-fixture';

/** Controlled policy fixture, matching the editor's loaded state. */
function PolicyFixture() {
    const [policies, setPolicies] = useState<ListingPolicyValues>({
        cancellation: 'Loaded policy'
    });
    return (
        <PoliciesPanel
            locale="en"
            idPrefix="test"
            keys={['cancellation', 'pets']}
            policies={policies}
            errors={{}}
            onChange={(key, value) => setPolicies((previous) => ({ ...previous, [key]: value }))}
        />
    );
}

describe('G17 loaded editor fields', () => {
    it('disables price and unit on request, and restores them without losing the stored amount', () => {
        const data = buildEditData({ isPriceOnRequest: true, priceFrom: 350000 });
        const props = {
            locale: 'en' as const,
            vertical: 'experience' as const,
            data,
            errors: {},
            onFieldChange: vi.fn()
        };
        const { rerender } = render(<PriceSection {...props} />);
        expect(screen.getByRole('spinbutton')).toBeDisabled();
        expect(screen.getByRole('combobox')).toBeDisabled();
        rerender(
            <PriceSection
                {...props}
                data={{ ...data, isPriceOnRequest: false }}
            />
        );
        expect(screen.getByRole('spinbutton')).toBeEnabled();
        expect(screen.getByRole('spinbutton')).toHaveValue(3500);
        expect(screen.getByRole('combobox')).toBeEnabled();
    });

    it('counts initially loaded cancellation text and subsequent edits', () => {
        render(<PolicyFixture />);
        expect(screen.getByText('13 of 1500 characters')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated' } });
        expect(screen.getByText('7 of 1500 characters')).toBeInTheDocument();
    });

    it('uses one visible pets label rather than an extra group heading', () => {
        const { container } = render(<PolicyFixture />);
        expect(container.querySelector('legend')).toBeNull();
    });
});
