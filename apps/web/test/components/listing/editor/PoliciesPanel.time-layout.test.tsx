/**
 * @file PoliciesPanel.time-layout.test.tsx
 * @description The check-in/check-out "Desde"/"Hasta" fields of the owner
 * editor's house-rules panel (HOS-2060 staging smoke).
 *
 * `TextField` renders a bare label + input fragment. Placed straight in the
 * two-column `.pair` grid, the label and the input of one end became separate
 * grid items, so a label sat over the other end's input. Each end must own a
 * single grid cell holding its label and its input.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PoliciesPanel } from '@/components/listing/editor/PoliciesPanel.client';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

describe('PoliciesPanel check-in/check-out layout (HOS-2060)', () => {
    it('keeps each time label and its input together in one grid cell', () => {
        // Arrange / Act
        render(
            <PoliciesPanel
                locale="es"
                idPrefix="test"
                keys={['checkIn', 'checkOut']}
                policies={{ checkIn: { from: '14:00', to: '20:00' } }}
                errors={{}}
                onChange={vi.fn()}
            />
        );

        // Assert
        const inputs = [
            ...screen.getAllByLabelText('Desde'),
            ...screen.getAllByLabelText('Hasta')
        ] as HTMLInputElement[];
        expect(inputs).toHaveLength(4);
        for (const input of inputs) {
            const cell = input.parentElement as HTMLElement;
            expect(cell.className).toContain('timeField');
            expect(cell.parentElement?.className).toContain('pair');
            const label = cell.querySelector(`label[for="${input.id}"]`);
            expect(label).not.toBeNull();
        }
    });
});
