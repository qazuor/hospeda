/**
 * @file usePropertyForm.test.ts
 * @description Unit tests for the usePropertyForm hook.
 * Covers section completion tracking, isFormComplete, missingRequiredFields,
 * handlePublish behaviour, and initialData pre-filling.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePropertyForm } from '../../src/hooks/usePropertyForm';
import type { AccommodationFormData } from '../../src/hooks/usePropertyForm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal form values that satisfy all required fields tracked by
 * SECTION_REQUIRED_FIELDS.  Note: these are the required fields that the
 * form *tracks for section completion*, not the full Zod schema.
 */
function buildSectionCompleteValues(): Partial<AccommodationFormData> {
    return {
        // datos-basicos
        name: 'Casa de Playa',
        summary: 'Hermosa casa con vista al mar en la costa.',
        type: 'HOUSE',
        // ubicacion
        location: {
            country: 'Argentina'
        },
        // capacidad
        extraInfo: {
            capacity: 6,
            minNights: 1,
            bedrooms: 3,
            bathrooms: 2
        },
        // fotos
        media: {
            gallery: [
                {
                    url: 'https://example.com/img.jpg',
                    moderationState: 'PENDING'
                }
            ]
        },
        // precio
        price: {
            price: 15000,
            currency: 'ARS'
        },
        // contacto
        contactInfo: {
            mobilePhone: '+5491123456789'
        }
    };
}

/**
 * Minimal valid values that satisfy the full AccommodationCreateInputSchema
 * so handlePublish can successfully call onPublish.
 * UUIDs are RFC 4122 v4 compliant (third group starts with 4, fourth with 8-b).
 */
function buildFullyValidValues(): Partial<AccommodationFormData> {
    return {
        ...buildSectionCompleteValues(),
        // Required by AccommodationCreateInputSchema (not tracked by sections)
        description:
            'Hermosa casa de playa con tres dormitorios y vista panorámica al mar. Perfecta para familias.',
        destinationId: 'a1b2c3d4-e5f6-4890-a1cd-ef1234567890',
        ownerId: 'f0e9d8c7-b6a5-4321-89dc-ba9876543210'
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePropertyForm', () => {
    // -----------------------------------------------------------------------
    // 1. completedSections: section becomes complete when required fields are filled
    // -----------------------------------------------------------------------

    describe('completedSections', () => {
        it('datos-basicos is not complete when required fields are missing', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            expect(result.current.completedSections.has('datos-basicos')).toBe(false);
        });

        it('datos-basicos transitions to complete when name, summary and type are filled', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            act(() => {
                result.current.form.setValue('name', 'Mi Cabaña');
                result.current.form.setValue('summary', 'Una hermosa cabaña en el bosque.');
                result.current.form.setValue('type', 'CABIN');
            });

            expect(result.current.completedSections.has('datos-basicos')).toBe(true);
        });

        it('datos-basicos becomes incomplete again when a required field is cleared', () => {
            const { result } = renderHook(() =>
                usePropertyForm({
                    initialData: {
                        name: 'Casa',
                        summary: 'Resumen corto de la propiedad.',
                        type: 'HOUSE'
                    },
                    onPublish: vi.fn()
                })
            );

            expect(result.current.completedSections.has('datos-basicos')).toBe(true);

            act(() => {
                result.current.form.setValue('name', '');
            });

            expect(result.current.completedSections.has('datos-basicos')).toBe(false);
        });

        it('amenities and publicar sections are always complete (no required fields)', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            expect(result.current.completedSections.has('amenities')).toBe(true);
            expect(result.current.completedSections.has('publicar')).toBe(true);
        });

        it('fotos section is complete when gallery has at least one image', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            expect(result.current.completedSections.has('fotos')).toBe(false);

            act(() => {
                result.current.form.setValue('media', {
                    gallery: [{ url: 'https://example.com/pic.jpg', moderationState: 'PENDING' }]
                });
            });

            expect(result.current.completedSections.has('fotos')).toBe(true);
        });

        it('precio section is complete when price.price and price.currency are set', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            expect(result.current.completedSections.has('precio')).toBe(false);

            act(() => {
                result.current.form.setValue('price', { price: 5000, currency: 'ARS' });
            });

            expect(result.current.completedSections.has('precio')).toBe(true);
        });

        it('contacto section is complete when mobilePhone is provided', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            act(() => {
                result.current.form.setValue('contactInfo', {
                    mobilePhone: '+5491112345678'
                });
            });

            expect(result.current.completedSections.has('contacto')).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // 2. isFormComplete: false when any required field is empty
    // -----------------------------------------------------------------------

    describe('isFormComplete', () => {
        it('is false when form is empty (no fields filled)', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            expect(result.current.isFormComplete).toBe(false);
        });

        it('is false when only some sections are filled', () => {
            const { result } = renderHook(() =>
                usePropertyForm({
                    initialData: {
                        name: 'Departamento Céntrico',
                        summary: 'Moderno departamento en pleno centro.',
                        type: 'APARTMENT'
                        // Missing: location.country, extraInfo, media.gallery, price, contactInfo
                    },
                    onPublish: vi.fn()
                })
            );

            expect(result.current.isFormComplete).toBe(false);
        });

        it('is true when all required fields across all 8 sections are filled', () => {
            const { result } = renderHook(() =>
                usePropertyForm({
                    initialData: buildSectionCompleteValues(),
                    onPublish: vi.fn()
                })
            );

            expect(result.current.isFormComplete).toBe(true);
        });

        it('flips to true as the last missing required field is filled', () => {
            const partialValues: Record<string, unknown> = { ...buildSectionCompleteValues() };
            // Remove the last section's field (contacto)
            partialValues.contactInfo = undefined;

            const { result } = renderHook(() =>
                usePropertyForm({ initialData: partialValues, onPublish: vi.fn() })
            );

            expect(result.current.isFormComplete).toBe(false);

            act(() => {
                result.current.form.setValue('contactInfo', {
                    mobilePhone: '+5491198765432'
                });
            });

            expect(result.current.isFormComplete).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // 3. missingRequiredFields: accurate list
    // -----------------------------------------------------------------------

    describe('missingRequiredFields', () => {
        it('lists all required field paths when form is empty', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            const missing = result.current.missingRequiredFields;

            expect(missing).toContain('name');
            expect(missing).toContain('summary');
            expect(missing).toContain('type');
            expect(missing).toContain('location.country');
            expect(missing).toContain('extraInfo.capacity');
            expect(missing).toContain('extraInfo.bedrooms');
            expect(missing).toContain('extraInfo.bathrooms');
            expect(missing).toContain('media.gallery');
            expect(missing).toContain('price.price');
            expect(missing).toContain('price.currency');
            expect(missing).toContain('contactInfo.mobilePhone');
        });

        it('does not include optional sections (amenities, publicar)', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            // No field paths from amenities or publicar sections should appear
            // since those sections have no required fields
            const missing = result.current.missingRequiredFields;
            // amenities section has [] required fields, publicar too
            // All paths in missing should be from the other sections
            const knownNonOptionalPaths = [
                'name',
                'summary',
                'type',
                'location.country',
                'extraInfo.capacity',
                'extraInfo.bedrooms',
                'extraInfo.bathrooms',
                'media.gallery',
                'price.price',
                'price.currency',
                'contactInfo.mobilePhone'
            ];
            for (const path of missing) {
                expect(knownNonOptionalPaths).toContain(path);
            }
        });

        it('removes a field from missing list when it is filled', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            expect(result.current.missingRequiredFields).toContain('name');

            act(() => {
                result.current.form.setValue('name', 'Villa del Sol');
            });

            expect(result.current.missingRequiredFields).not.toContain('name');
        });

        it('returns empty array when all required fields are present', () => {
            const { result } = renderHook(() =>
                usePropertyForm({
                    initialData: buildSectionCompleteValues(),
                    onPublish: vi.fn()
                })
            );

            expect(result.current.missingRequiredFields).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // 4. handlePublish: does NOT call onPublish when form is incomplete
    // -----------------------------------------------------------------------

    describe('handlePublish — incomplete form', () => {
        it('does not call onPublish when form data fails Zod validation', async () => {
            const onPublish = vi.fn();

            const { result } = renderHook(() => usePropertyForm({ onPublish }));

            await act(async () => {
                await result.current.handlePublish();
            });

            expect(onPublish).not.toHaveBeenCalled();
        });

        it('does not call onPublish when only section-completion fields are filled but Zod required fields are missing', async () => {
            // Section completion fields are filled but Zod still needs description, destinationId, ownerId
            const onPublish = vi.fn();

            const { result } = renderHook(() =>
                usePropertyForm({
                    initialData: buildSectionCompleteValues(),
                    onPublish
                })
            );

            // isFormComplete is true (section tracking) but Zod validation will fail
            expect(result.current.isFormComplete).toBe(true);

            await act(async () => {
                await result.current.handlePublish();
            });

            // Zod fails because description, destinationId, ownerId are missing
            expect(onPublish).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // 5. handlePublish: calls onPublish with full data when valid
    // -----------------------------------------------------------------------

    describe('handlePublish — complete form', () => {
        it('calls onPublish with the full form data when Zod validation passes', async () => {
            const onPublish = vi.fn().mockResolvedValue(undefined);
            const validValues = buildFullyValidValues();

            const { result } = renderHook(() =>
                usePropertyForm({
                    initialData: validValues,
                    onPublish
                })
            );

            await act(async () => {
                await result.current.handlePublish();
            });

            expect(onPublish).toHaveBeenCalledTimes(1);
            const callArg = onPublish.mock.calls[0]?.[0];
            expect(callArg).toMatchObject({
                name: validValues.name,
                summary: validValues.summary,
                type: validValues.type
            });
        });

        it('does not call onPublish a second time while the first publish is in-flight', async () => {
            let resolvePublish: () => void = () => {};
            const onPublish = vi.fn().mockImplementation(
                () =>
                    new Promise<void>((resolve) => {
                        resolvePublish = resolve;
                    })
            );
            const validValues = buildFullyValidValues();

            const { result } = renderHook(() =>
                usePropertyForm({
                    initialData: validValues,
                    onPublish
                })
            );

            // Start first publish — do not await
            act(() => {
                void result.current.handlePublish();
            });

            // Attempt second publish while first is in-flight
            await act(async () => {
                await result.current.handlePublish();
            });

            // Resolve the in-flight publish
            await act(async () => {
                resolvePublish();
            });

            expect(onPublish).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // 6. initialData: form is pre-filled
    // -----------------------------------------------------------------------

    describe('initialData', () => {
        it('pre-fills form values from initialData prop', () => {
            const initialData: Partial<AccommodationFormData> = {
                name: 'Cabaña del Río',
                summary: 'Cabaña a orillas del río con acceso privado.',
                type: 'CABIN'
            };

            const { result } = renderHook(() =>
                usePropertyForm({ initialData, onPublish: vi.fn() })
            );

            expect(result.current.form.values.name).toBe('Cabaña del Río');
            expect(result.current.form.values.summary).toBe(
                'Cabaña a orillas del río con acceso privado.'
            );
            expect(result.current.form.values.type).toBe('CABIN');
        });

        it('marks datos-basicos as complete when initialData provides all required fields', () => {
            const { result } = renderHook(() =>
                usePropertyForm({
                    initialData: {
                        name: 'Hostel Central',
                        summary: 'Hostel en pleno centro histórico de la ciudad.',
                        type: 'HOSTEL'
                    },
                    onPublish: vi.fn()
                })
            );

            expect(result.current.completedSections.has('datos-basicos')).toBe(true);
        });

        it('marks all tracked sections as complete when initialData provides all required fields', () => {
            const { result } = renderHook(() =>
                usePropertyForm({
                    initialData: buildSectionCompleteValues(),
                    onPublish: vi.fn()
                })
            );

            const { completedSections, sections } = result.current;
            for (const section of sections) {
                expect(completedSections.has(section)).toBe(true);
            }
        });

        it('allows resetting the form to empty state via form.reset()', () => {
            const { result } = renderHook(() =>
                usePropertyForm({
                    initialData: {
                        name: 'Hotel Boutique',
                        summary: 'Un hotel boutique con estilo único.',
                        type: 'HOTEL'
                    },
                    onPublish: vi.fn()
                })
            );

            expect(result.current.form.values.name).toBe('Hotel Boutique');

            act(() => {
                result.current.form.reset();
            });

            expect(result.current.form.values.name).toBeUndefined();
            expect(result.current.completedSections.has('datos-basicos')).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // 7. sections: returns all 8 section keys in order
    // -----------------------------------------------------------------------

    describe('sections', () => {
        it('returns all 8 section keys', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            expect(result.current.sections).toHaveLength(8);
            expect(result.current.sections[0]).toBe('datos-basicos');
            expect(result.current.sections[7]).toBe('publicar');
        });

        it('includes all expected section keys', () => {
            const { result } = renderHook(() => usePropertyForm({ onPublish: vi.fn() }));

            const expectedSections = [
                'datos-basicos',
                'ubicacion',
                'capacidad',
                'amenities',
                'fotos',
                'precio',
                'contacto',
                'publicar'
            ];

            for (const section of expectedSections) {
                expect(result.current.sections).toContain(section);
            }
        });
    });
});
