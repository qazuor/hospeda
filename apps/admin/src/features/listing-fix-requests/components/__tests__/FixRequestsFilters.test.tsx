// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FixRequestsFilters } from '../FixRequestsFilters';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

describe('TEST:1704:6 AC:1704:7 pending fix request filters', () => {
    it('emits each selected filter and clears an unchecked overdue filter', () => {
        const onChange = vi.fn();
        render(
            <FixRequestsFilters
                value={{}}
                onChange={onChange}
            />
        );
        fireEvent.change(screen.getByLabelText('admin-entities.fixRequestList.filters.vertical'), {
            target: { value: 'venue' }
        });
        expect(onChange).toHaveBeenLastCalledWith({ vertical: 'venue' });
        fireEvent.change(
            screen.getByLabelText('admin-entities.fixRequestList.filters.ownerReported'),
            { target: { value: 'no' } }
        );
        expect(onChange).toHaveBeenLastCalledWith({ ownerReported: 'no' });
        fireEvent.click(screen.getByLabelText('admin-entities.fixRequestList.filters.overdue'));
        expect(onChange).toHaveBeenLastCalledWith({ overdue: 'true' });
    });
});
