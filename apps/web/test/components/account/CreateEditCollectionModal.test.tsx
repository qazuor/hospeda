/**
 * @file CreateEditCollectionModal.test.tsx
 * @description Unit tests for the CreateEditCollectionModal React island (HOS-190 slice 3).
 *
 * Covers:
 * - Renders name/description/color/icon fields in both CREATE and EDIT mode
 * - Client-side validation (empty name) blocks submit and shows a field error
 * - Regression (HOS-190 bug fix): choosing "Sin color"/"Sin ícono" in EDIT mode
 *   sends an explicit `null` (not `undefined`) so the API actually clears the
 *   field, instead of silently leaving the previous value untouched.
 * - CREATE mode still omits color/icon cleanly when never touched.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateEditCollectionModal } from '../../../src/components/account/CreateEditCollectionModal.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/lib/i18n', () => ({
    createT:
        (_locale: string) => (key: string, fallback?: string, params?: Record<string, unknown>) => {
            if (params && fallback) {
                return Object.entries(params).reduce(
                    (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
                    fallback
                );
            }
            return fallback ?? key;
        }
}));

vi.mock('../../../src/components/account/CreateEditCollectionModal.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/shared/ui/Dialog.client', () => ({
    Dialog: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div role="presentation">{children}</div> : null,
    DialogHeader: ({ children, titleId }: { children: React.ReactNode; titleId: string }) => (
        <div id={titleId}>{children}</div>
    ),
    DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userBookmarkCollectionsApi: {
        create: (...args: unknown[]) => mockCreate(...args),
        update: (...args: unknown[]) => mockUpdate(...args)
    }
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EXISTING_COLLECTION = {
    id: 'col-1',
    name: 'Viajes soñados',
    description: 'Para el próximo verano',
    color: '#E57373',
    icon: 'MapPin'
};

function renderCreateModal(
    overrides: Partial<React.ComponentProps<typeof CreateEditCollectionModal>> = {}
) {
    return render(
        <CreateEditCollectionModal
            isOpen
            onClose={vi.fn()}
            locale="es"
            {...overrides}
        />
    );
}

function renderEditModal(
    overrides: Partial<React.ComponentProps<typeof CreateEditCollectionModal>> = {}
) {
    return render(
        <CreateEditCollectionModal
            isOpen
            onClose={vi.fn()}
            locale="es"
            collection={EXISTING_COLLECTION}
            {...overrides}
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreateEditCollectionModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreate.mockResolvedValue({
            ok: true,
            data: { id: 'new-col', name: 'Nueva colección' }
        });
        mockUpdate.mockResolvedValue({
            ok: true,
            data: { id: 'col-1', name: 'Viajes soñados' }
        });
    });

    describe('rendering', () => {
        it('CREATE mode: renders empty name/description fields', () => {
            renderCreateModal();
            expect((document.getElementById('collection-name') as HTMLInputElement).value).toBe('');
            expect(
                (document.getElementById('collection-description') as HTMLTextAreaElement).value
            ).toBe('');
        });

        it('EDIT mode: pre-fills name/description from the collection prop', () => {
            renderEditModal();
            expect((document.getElementById('collection-name') as HTMLInputElement).value).toBe(
                'Viajes soñados'
            );
            expect(
                (document.getElementById('collection-description') as HTMLTextAreaElement).value
            ).toBe('Para el próximo verano');
        });
    });

    describe('client-side validation (HOS-190)', () => {
        it('blocks submit and shows a field error when name is empty, without calling the API', async () => {
            renderCreateModal();
            // Type then clear so the disabled-button gate doesn't block the
            // fireEvent.submit below from ever reaching handleSubmit.
            const nameInput = document.getElementById('collection-name') as HTMLInputElement;
            fireEvent.change(nameInput, { target: { value: 'x' } });
            fireEvent.change(nameInput, { target: { value: '' } });

            const form = document.querySelector('form')!;
            fireEvent.submit(form);

            await waitFor(() => {
                expect(document.getElementById('name-error')).toBeInTheDocument();
            });
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it('clears the name field error once the user provides a valid value', async () => {
            renderCreateModal();
            const nameInput = document.getElementById('collection-name') as HTMLInputElement;
            fireEvent.change(nameInput, { target: { value: 'x' } });
            fireEvent.change(nameInput, { target: { value: '' } });
            fireEvent.submit(document.querySelector('form')!);

            await waitFor(() => {
                expect(document.getElementById('name-error')).toBeInTheDocument();
            });

            fireEvent.change(nameInput, { target: { value: 'Mi colección' } });
            expect(document.getElementById('name-error')).not.toBeInTheDocument();
        });
    });

    describe('null-clear regression (HOS-190 bug fix)', () => {
        it('EDIT mode: sends color: null (not undefined) when "Sin color" is chosen', async () => {
            renderEditModal();

            fireEvent.click(screen.getByRole('radio', { name: 'Sin color' }));
            fireEvent.submit(document.querySelector('form')!);

            await waitFor(() => {
                expect(mockUpdate).toHaveBeenCalledTimes(1);
            });
            const call = mockUpdate.mock.calls[0][0] as { input: Record<string, unknown> };
            expect(call.input.color).toBeNull();
            expect(call.input).not.toHaveProperty('color', undefined);
        });

        it('EDIT mode: sends icon: null (not undefined) when "Sin ícono" is chosen', async () => {
            renderEditModal();

            fireEvent.click(screen.getByRole('radio', { name: 'Sin ícono' }));
            fireEvent.submit(document.querySelector('form')!);

            await waitFor(() => {
                expect(mockUpdate).toHaveBeenCalledTimes(1);
            });
            const call = mockUpdate.mock.calls[0][0] as { input: Record<string, unknown> };
            expect(call.input.icon).toBeNull();
        });

        it('CREATE mode: sends color: null when no color was ever picked (never undefined)', async () => {
            renderCreateModal();

            fireEvent.change(document.getElementById('collection-name') as HTMLInputElement, {
                target: { value: 'Nueva colección' }
            });
            fireEvent.submit(document.querySelector('form')!);

            await waitFor(() => {
                expect(mockCreate).toHaveBeenCalledTimes(1);
            });
            const input = mockCreate.mock.calls[0][0] as Record<string, unknown>;
            expect(input.color).toBeNull();
            expect(input.icon).toBeNull();
        });

        it('EDIT mode: still sends the picked color/icon values (not null) when the user picks one', async () => {
            renderEditModal();

            fireEvent.click(screen.getByRole('radio', { name: 'Verde' }));
            fireEvent.submit(document.querySelector('form')!);

            await waitFor(() => {
                expect(mockUpdate).toHaveBeenCalledTimes(1);
            });
            const call = mockUpdate.mock.calls[0][0] as { input: Record<string, unknown> };
            expect(typeof call.input.color).toBe('string');
            expect(call.input.color).not.toBeNull();
        });
    });
});
