/**
 * @file PropertyCardMenu.test.tsx
 * @description HOS-2483: the property card's «Más acciones» menu. Links
 * navigate; Despublicar and Eliminar open a dialog with the SAME confirmation
 * islands, already on their confirmation step, and Cancelar closes it.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PropertyCardMenu } from '../../../src/components/host/PropertyCardMenu.client';

const purgePreviewMock = vi.fn();
const unpublishMock = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    publishApi: {
        purge: vi.fn(),
        purgePreview: (args: unknown) => purgePreviewMock(args)
    },
    accommodationEditApi: { unpublish: (args: unknown) => unpublishMock(args) }
}));

const REMOVE = {
    listingId: 'p1',
    locale: 'es' as const,
    label: 'Eliminar',
    confirmText: '¿Eliminar esta propiedad?',
    confirmYes: 'Sí, eliminar',
    confirmNo: 'Cancelar',
    errorText: 'No se pudo eliminar.'
};
const UNPUBLISH = {
    accommodationId: 'p1',
    locale: 'es' as const,
    label: 'Despublicar',
    confirmText: '¿Despublicar esta propiedad?',
    confirmYes: 'Sí, despublicar',
    confirmNo: 'Cancelar',
    errorText: 'No se pudo despublicar.'
};

const openMenu = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones para Casa' }));

afterEach(() => vi.clearAllMocks());

describe('PropertyCardMenu', () => {
    it('lists only the actions it was given, the external one marked as a new tab', () => {
        // Arrange
        render(
            <PropertyCardMenu
                locale="es"
                label="Más acciones para Casa"
                viewOnSite={{ href: '/es/alojamientos/casa/', label: 'Ver en el sitio' }}
                remove={REMOVE}
            />
        );

        // Act
        openMenu();

        // Assert
        const items = screen.getAllByRole('menuitem');
        expect(items.map((item) => item.textContent)).toEqual([
            'Ver en el sitio (se abre en otra pestaña)',
            'Eliminar'
        ]);
        expect(items[0]).toHaveAttribute('target', '_blank');
    });

    it('renders nothing without a secondary action', () => {
        const { container } = render(
            <PropertyCardMenu
                locale="es"
                label="Más acciones para Casa"
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('Eliminar opens the delete confirmation straight away, with the add-on preview', async () => {
        // Arrange
        purgePreviewMock.mockResolvedValue({ ok: true, data: { lostAddons: [] } });
        render(
            <PropertyCardMenu
                locale="es"
                label="Más acciones para Casa"
                remove={REMOVE}
            />
        );

        // Act
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar' }));

        // Assert
        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText('¿Eliminar esta propiedad?')).toBeInTheDocument();
        await waitFor(() =>
            expect(purgePreviewMock).toHaveBeenCalledWith({ vertical: 'accommodation', id: 'p1' })
        );
    });

    it('Cancelar inside the dialog closes it', async () => {
        // Arrange
        render(
            <PropertyCardMenu
                locale="es"
                label="Más acciones para Casa"
                unpublish={UNPUBLISH}
            />
        );
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Despublicar' }));
        const dialog = await screen.findByRole('alertdialog');

        // Act
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

        // Assert
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(unpublishMock).not.toHaveBeenCalled();
    });
});
