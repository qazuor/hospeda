import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareBar } from '../../../../src/components/shared/compare/CompareBar.client';

const mockStore = vi.hoisted(() => ({
    value: { ids: ['a'], items: [{ id: 'a', name: 'Cabaña A' }] }
}));

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
            const base = fallback ?? '';
            return params
                ? Object.entries(params).reduce(
                      (value, [key, replacement]) =>
                          value.replaceAll(`{{${key}}}`, String(replacement)),
                      base
                  )
                : base;
        },
        tPlural: (_key: string, count: number) => `${count} seleccionados`
    })
}));
vi.mock('../../../../src/components/shared/compare/CompareBar.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, prop) => String(prop) })
}));
vi.mock('@repo/icons', () => ({
    ArrowRightIcon: () => <svg aria-hidden="true" />,
    XIcon: () => <svg aria-hidden="true" />
}));
vi.mock('../../../../src/store/compare-store', () => ({
    useCompareStore: () => mockStore.value,
    removeFromCompare: vi.fn(),
    clearCompare: vi.fn()
}));
vi.mock('../../../../src/hooks/useCompareGuard', () => ({
    useCompareGuard: () => ({ maxItems: 2, isLoading: false })
}));

const CSS_SOURCE = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/compare/CompareBar.module.css'),
    'utf8'
);

const dockSlot = (): HTMLElement => {
    const slot = document.querySelector<HTMLElement>('[data-mobile-dock-slot="above"]');
    if (!slot) throw new Error('Compare dock slot was not mounted');
    return slot;
};

describe('CompareBar mobile dock (TEST:1768:17)', () => {
    beforeEach(() => {
        mockStore.value = { ids: ['a'], items: [{ id: 'a', name: 'Cabaña A' }] };
        document.body.innerHTML = '<div data-mobile-dock-slot="above"></div>';
    });

    it('portals the selected comparison region into the above slot', async () => {
        render(<CompareBar locale="es" />);

        await waitFor(() => {
            expect(
                within(dockSlot()).getByRole('region', { name: 'Comparar alojamientos' })
            ).toBeInTheDocument();
        });
        expect(screen.getByText('Comparás 1 de 2')).toBeInTheDocument();
    });

    it('leaves the mounted slot empty without a selection', async () => {
        mockStore.value = { ids: [], items: [] };
        render(<CompareBar locale="es" />);
        await waitFor(() => expect(dockSlot()).toBeEmptyDOMElement());
    });

    it('keeps desktop positioning and stacks inside the mobile dock', () => {
        expect(CSS_SOURCE).toContain('bottom: 0;');
        expect(CSS_SOURCE).toContain('z-index: calc(var(--z-toast, 200) + 10);');
        expect(CSS_SOURCE).toContain('@media (max-width: 767px)');
        expect(CSS_SOURCE).toContain(':global([data-mobile-dock]) .bar');
        expect(CSS_SOURCE).toContain('position: static;');
    });
});
