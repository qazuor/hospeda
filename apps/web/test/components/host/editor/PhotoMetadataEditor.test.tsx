/**
 * @file PhotoMetadataEditor.test.tsx
 * @description Unit tests for the per-photo text metadata editor (HOS-125 —
 * the missing half of H-125: hosts had no way to write `alt`/`caption`/
 * `description` on their own photos).
 *
 * Covers:
 * - Writing a NEW alt calls onSave with the typed value
 * - Correcting an EXISTING alt replaces it (not appended, not ignored)
 * - Clearing a field sends `null`, never `''`
 * - Zod-matching length bounds are enforced BEFORE onSave is called
 * - A save on this photo does not touch fields the host didn't type into
 *   (the payload only carries what the form currently holds for THIS item)
 * - Cancel closes the panel without calling onSave
 * - Reopening the panel re-syncs fields from the item's current values
 * - Disabled / no-DB-id states block the toggle
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PhotoMetadataEditorProps } from '@/components/host/editor/PhotoMetadataEditor.client';
import { PhotoMetadataEditor } from '@/components/host/editor/PhotoMetadataEditor.client';
import type { AccommodationMediaItem } from '@/lib/api/types';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw = fallback ?? key;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                raw
            );
        },
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

const BASE_ITEM: AccommodationMediaItem = {
    id: 'media-1',
    url: 'https://cdn.example.com/photo.jpg',
    publicId: 'gallery/media-1',
    isFeatured: false
};

function makeProps(overrides: Partial<PhotoMetadataEditorProps> = {}): PhotoMetadataEditorProps {
    return {
        locale: 'es',
        item: BASE_ITEM,
        disabled: false,
        toggleAriaLabel: 'Editar textos de la foto 1',
        closeAriaLabel: 'Cerrar edición de textos de la foto 1',
        onSave: vi.fn().mockResolvedValue(true),
        ...overrides
    };
}

function openPanel() {
    fireEvent.click(screen.getByLabelText('Editar textos de la foto 1'));
}

describe('PhotoMetadataEditor', () => {
    // ── Toggle ────────────────────────────────────────────────────────────

    it('keeps the form collapsed until the toggle is clicked', () => {
        render(<PhotoMetadataEditor {...makeProps()} />);
        expect(screen.queryByLabelText('¿Qué muestra la foto?')).not.toBeInTheDocument();
        openPanel();
        expect(screen.getByLabelText('¿Qué muestra la foto?')).toBeInTheDocument();
    });

    it('disables the toggle when disabled is true', () => {
        render(<PhotoMetadataEditor {...makeProps({ disabled: true })} />);
        expect(screen.getByLabelText('Editar textos de la foto 1')).toBeDisabled();
    });

    it('disables the toggle when the item has no DB id yet (SSR placeholder)', () => {
        render(<PhotoMetadataEditor {...makeProps({ item: { ...BASE_ITEM, id: '' } })} />);
        expect(screen.getByLabelText('Editar textos de la foto 1')).toBeDisabled();
    });

    // ── Writing / correcting alt ─────────────────────────────────────────

    it('persists a newly-typed alt via onSave with this photo as the target', async () => {
        const onSave = vi.fn().mockResolvedValue(true);
        render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
        openPanel();

        fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
            target: { value: 'Living con sofá y ventanal al jardín' }
        });
        fireEvent.click(screen.getByText('Guardar'));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith(
                BASE_ITEM,
                expect.objectContaining({ alt: 'Living con sofá y ventanal al jardín' })
            );
        });
    });

    it('shows the CURRENT alt when opened, and replaces it (not appends) on correction', async () => {
        const itemWithAlt: AccommodationMediaItem = { ...BASE_ITEM, alt: 'foto vieja' };
        const onSave = vi.fn().mockResolvedValue(true);
        render(<PhotoMetadataEditor {...makeProps({ item: itemWithAlt, onSave })} />);
        openPanel();

        const altField = screen.getByLabelText('¿Qué muestra la foto?') as HTMLTextAreaElement;
        expect(altField.value).toBe('foto vieja');

        fireEvent.change(altField, {
            target: { value: 'Dormitorio principal con cama matrimonial' }
        });
        fireEvent.click(screen.getByText('Guardar'));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith(
                itemWithAlt,
                expect.objectContaining({ alt: 'Dormitorio principal con cama matrimonial' })
            );
        });
    });

    // ── Clearing sends null, never '' ────────────────────────────────────

    it('sends null (not an empty string) when a filled field is cleared', async () => {
        const itemWithAllFields: AccommodationMediaItem = {
            ...BASE_ITEM,
            alt: 'texto viejo',
            caption: 'epígrafe viejo',
            description: 'descripción vieja bien larga'
        };
        const onSave = vi.fn().mockResolvedValue(true);
        render(<PhotoMetadataEditor {...makeProps({ item: itemWithAllFields, onSave })} />);
        openPanel();

        fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
            target: { value: '' }
        });
        fireEvent.change(screen.getByLabelText('Epígrafe (opcional)'), {
            target: { value: '' }
        });
        fireEvent.change(screen.getByLabelText('Descripción (opcional)'), {
            target: { value: '' }
        });
        fireEvent.click(screen.getByText('Guardar'));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith(itemWithAllFields, {
                alt: null,
                caption: null,
                description: null,
                attribution: null
            });
        });

        const [, body] = onSave.mock.calls[0] as [AccommodationMediaItem, Record<string, unknown>];
        expect(body.alt).not.toBe('');
        expect(body.caption).not.toBe('');
        expect(body.description).not.toBe('');
    });

    // ── Length validation mirrors the Zod bounds — checked BEFORE calling ──

    describe('length validation before calling onSave', () => {
        it('blocks the save when caption is below the 3-char minimum', async () => {
            const onSave = vi.fn().mockResolvedValue(true);
            render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
            openPanel();

            fireEvent.change(screen.getByLabelText('Epígrafe (opcional)'), {
                target: { value: 'ab' }
            });
            fireEvent.click(screen.getByText('Guardar'));

            await waitFor(() => {
                expect(
                    screen.getByText('El epígrafe debe tener al menos 3 caracteres, o dejalo vacío')
                ).toBeInTheDocument();
            });
            expect(onSave).not.toHaveBeenCalled();
        });

        it('blocks the save when caption is above the 100-char maximum', async () => {
            const onSave = vi.fn().mockResolvedValue(true);
            render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
            openPanel();

            fireEvent.change(screen.getByLabelText('Epígrafe (opcional)'), {
                target: { value: 'x'.repeat(101) }
            });
            fireEvent.click(screen.getByText('Guardar'));

            await waitFor(() => {
                expect(
                    screen.getByText('El epígrafe no puede superar 100 caracteres')
                ).toBeInTheDocument();
            });
            expect(onSave).not.toHaveBeenCalled();
        });

        it('blocks the save when description is below the 10-char minimum', async () => {
            const onSave = vi.fn().mockResolvedValue(true);
            render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
            openPanel();

            fireEvent.change(screen.getByLabelText('Descripción (opcional)'), {
                target: { value: 'corta' }
            });
            fireEvent.click(screen.getByText('Guardar'));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'La descripción debe tener al menos 10 caracteres, o dejala vacía'
                    )
                ).toBeInTheDocument();
            });
            expect(onSave).not.toHaveBeenCalled();
        });

        it('blocks the save when alt is above the 200-char maximum', async () => {
            const onSave = vi.fn().mockResolvedValue(true);
            render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
            openPanel();

            fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
                target: { value: 'x'.repeat(201) }
            });
            fireEvent.click(screen.getByText('Guardar'));

            await waitFor(() => {
                expect(
                    screen.getByText('El texto no puede superar 200 caracteres')
                ).toBeInTheDocument();
            });
            expect(onSave).not.toHaveBeenCalled();
        });

        it('allows an empty caption/description even though they have a minimum length', async () => {
            const onSave = vi.fn().mockResolvedValue(true);
            render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
            openPanel();

            fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
                target: { value: 'Living con sofá' }
            });
            fireEvent.click(screen.getByText('Guardar'));

            await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        });
    });

    // ── Save does not carry other photos' data ───────────────────────────

    it('targets exactly the item passed in, not any other photo', async () => {
        const onSave = vi.fn().mockResolvedValue(true);
        const thisItem: AccommodationMediaItem = { ...BASE_ITEM, id: 'media-this-one' };
        render(<PhotoMetadataEditor {...makeProps({ item: thisItem, onSave })} />);
        openPanel();

        fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
            target: { value: 'Cocina integrada' }
        });
        fireEvent.click(screen.getByText('Guardar'));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        const [savedItem] = onSave.mock.calls[0] as [AccommodationMediaItem];
        expect(savedItem.id).toBe('media-this-one');
    });

    // ── Cancel ────────────────────────────────────────────────────────────

    it('closes the panel without calling onSave when cancel is clicked', () => {
        const onSave = vi.fn();
        render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
        openPanel();

        fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
            target: { value: 'algo sin guardar' }
        });
        fireEvent.click(screen.getByText('Cancelar'));

        expect(screen.queryByLabelText('¿Qué muestra la foto?')).not.toBeInTheDocument();
        expect(onSave).not.toHaveBeenCalled();
    });

    // ── Reopening re-syncs from the item's current values ────────────────

    it('re-syncs the form from the item on reopen instead of keeping stale local edits', () => {
        const itemWithAlt: AccommodationMediaItem = { ...BASE_ITEM, alt: 'valor persistido' };
        render(<PhotoMetadataEditor {...makeProps({ item: itemWithAlt })} />);

        openPanel();
        fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
            target: { value: 'edición sin guardar' }
        });
        fireEvent.click(screen.getByLabelText('Cerrar edición de textos de la foto 1'));

        openPanel();
        expect((screen.getByLabelText('¿Qué muestra la foto?') as HTMLTextAreaElement).value).toBe(
            'valor persistido'
        );
    });

    // ── Save confirmation ─────────────────────────────────────────────────

    it('shows a saved confirmation after a successful save', async () => {
        const onSave = vi.fn().mockResolvedValue(true);
        render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
        openPanel();

        fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
            target: { value: 'Living luminoso' }
        });
        fireEvent.click(screen.getByText('Guardar'));

        await waitFor(() => expect(screen.getByText('Guardado')).toBeInTheDocument());
    });

    it('does not show a saved confirmation when onSave fails', async () => {
        const onSave = vi.fn().mockResolvedValue(false);
        render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
        openPanel();

        fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
            target: { value: 'Living luminoso' }
        });
        fireEvent.click(screen.getByText('Guardar'));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(screen.queryByText('Guardado')).not.toBeInTheDocument();
    });

    // ── Photo credit (H-125, attribution half) ────────────────────────────

    describe('photo credit', () => {
        it('explains WHEN the credit has to be filled in, not just what it is', () => {
            render(<PhotoMetadataEditor {...makeProps()} />);
            openPanel();

            const hint = screen.getByText(/Dejalo vacío si la foto es tuya/);
            // The point of the copy is the obligation, not the field name: a host
            // has to learn that somebody else's photo usually requires naming them.
            expect(hint.textContent).toMatch(/fotógrafo|banco de fotos/);
        });

        it('saves the two credit fields as an attribution object', async () => {
            const onSave = vi.fn().mockResolvedValue(true);
            render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
            openPanel();

            fireEvent.change(screen.getByLabelText('¿Quién sacó la foto?'), {
                target: { value: 'Estudio Paraná' }
            });
            fireEvent.change(screen.getByLabelText('Link del autor (opcional)'), {
                target: { value: 'https://estudioparana.com.ar' }
            });
            fireEvent.click(screen.getByText('Guardar'));

            await waitFor(() => {
                expect(onSave).toHaveBeenCalledWith(
                    BASE_ITEM,
                    expect.objectContaining({
                        attribution: {
                            photographer: 'Estudio Paraná',
                            sourceUrl: 'https://estudioparana.com.ar',
                            provider: 'user-upload'
                        }
                    })
                );
            });
        });

        it('saves with neither credit field filled — both are optional', async () => {
            const onSave = vi.fn().mockResolvedValue(true);
            render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
            openPanel();

            fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
                target: { value: 'Living con sofá' }
            });
            fireEvent.click(screen.getByText('Guardar'));

            await waitFor(() => {
                expect(onSave).toHaveBeenCalledWith(
                    BASE_ITEM,
                    expect.objectContaining({ attribution: null })
                );
            });
        });

        it('shows the CURRENT credit when the panel opens', () => {
            const credited: AccommodationMediaItem = {
                ...BASE_ITEM,
                attribution: {
                    photographer: 'Ana Gómez',
                    sourceUrl: 'https://anagomez.example',
                    provider: 'user-upload'
                }
            };
            render(<PhotoMetadataEditor {...makeProps({ item: credited })} />);
            openPanel();

            expect((screen.getByLabelText('¿Quién sacó la foto?') as HTMLInputElement).value).toBe(
                'Ana Gómez'
            );
            expect(
                (screen.getByLabelText('Link del autor (opcional)') as HTMLInputElement).value
            ).toBe('https://anagomez.example');
        });

        it('refuses a non-http credit link and never calls onSave', async () => {
            const onSave = vi.fn().mockResolvedValue(true);
            render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
            openPanel();

            fireEvent.change(screen.getByLabelText('¿Quién sacó la foto?'), {
                target: { value: 'Mallory' }
            });
            fireEvent.change(screen.getByLabelText('Link del autor (opcional)'), {
                target: { value: 'javascript:alert(1)' }
            });
            fireEvent.click(screen.getByText('Guardar'));

            await waitFor(() => {
                expect(screen.getByText(/http:\/\/ o https:\/\//)).toBeInTheDocument();
            });
            expect(onSave).not.toHaveBeenCalled();
        });

        it('refuses a link with no name behind it', async () => {
            const onSave = vi.fn().mockResolvedValue(true);
            render(<PhotoMetadataEditor {...makeProps({ onSave })} />);
            openPanel();

            fireEvent.change(screen.getByLabelText('Link del autor (opcional)'), {
                target: { value: 'https://estudioparana.com.ar' }
            });
            fireEvent.click(screen.getByText('Guardar'));

            await waitFor(() => {
                expect(screen.getByText(/Escribí a quién pertenece la foto/)).toBeInTheDocument();
            });
            expect(onSave).not.toHaveBeenCalled();
        });
    });
});
