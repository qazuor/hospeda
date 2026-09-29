/**
 * @file PhotoSection.upload-errors.test.tsx
 * @description HOS-1218 — every refusal the `upload-entity` endpoint can answer
 * is RENDERED to the host in Spanish, never as the API's English log message
 * and never as a raw i18n key.
 *
 * The toast store, the toast renderer and the translator are REAL (same setup
 * as `PhotoSection.limit.test.tsx`); only the upload edge is mocked, rejecting
 * with the typed error the real helper builds from the API's payload.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoSectionProps } from '@/components/host/editor/PhotoSection.client';
import { PhotoSection } from '@/components/host/editor/PhotoSection.client';
import { ToastViewport } from '@/components/ui/ToastViewport.client';
import { buildUploadEntityError } from '@/lib/media/upload-entity-error';
import { clearToasts } from '@/store/toast-store';

const { mockListMedia, mockUploadEntityImage } = vi.hoisted(() => ({
    mockListMedia: vi.fn(),
    mockUploadEntityImage: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: {
        listMedia: mockListMedia,
        addMedia: vi.fn(),
        addFeaturedMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn(),
        reorderMedia: vi.fn(),
        updateMedia: vi.fn()
    },
    protectedMediaApi: { deleteMedia: vi.fn() }
}));

vi.mock('@/lib/media/upload-entity', () => ({
    uploadEntityImage: mockUploadEntityImage
}));

vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: () => false,
        limit: () => 50,
        plan: null,
        isLoading: false,
        error: null
    })
}));

const props: PhotoSectionProps = { locale: 'es', accommodationId: 'acc-uuid-123' };

interface Case {
    readonly name: string;
    readonly status: number;
    readonly error: {
        readonly code: string;
        readonly reason?: string;
        readonly message: string;
        readonly details?: unknown;
    };
    readonly expectedEs: string;
}

/** The nine literals `upload-entity.ts` builds, as the API sends them. */
const CASES: readonly Case[] = [
    {
        name: 'service not configured',
        status: 503,
        error: {
            code: 'CLOUDINARY_NOT_CONFIGURED',
            message: 'Media upload service is not configured'
        },
        expectedEs:
            'El servicio de subida de fotos no está disponible en este momento. Probá de nuevo en unos minutos.'
    },
    {
        name: 'internal error',
        status: 500,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        expectedEs: 'Algo salió mal del lado nuestro. Intentá de nuevo en un momento.'
    },
    {
        name: 'session stale',
        status: 401,
        error: {
            code: 'SESSION_STALE',
            message: 'Session expired or revoked. Please re-authenticate.'
        },
        expectedEs: 'Tu sesión venció. Volvé a iniciar sesión y probá de nuevo.'
    },
    {
        name: 'invalid multipart',
        status: 400,
        error: {
            code: 'VALIDATION_ERROR',
            reason: 'INVALID_MULTIPART_DATA',
            message: 'Invalid multipart form data'
        },
        expectedEs: 'No pudimos leer el archivo que enviaste. Probá de nuevo.'
    },
    {
        name: 'invalid form fields',
        status: 400,
        error: {
            code: 'VALIDATION_ERROR',
            reason: 'INVALID_FORM_FIELDS',
            message: 'Invalid form fields',
            details: [{ field: 'role', message: 'Invalid enum value' }]
        },
        expectedEs: 'Los datos de la subida no son válidos. Recargá la página y probá de nuevo.'
    },
    {
        name: 'unsupported entity type',
        status: 400,
        error: {
            code: 'VALIDATION_ERROR',
            reason: 'UNSUPPORTED_ENTITY_TYPE',
            message: 'Unsupported entity type: widget'
        },
        expectedEs: 'No se pueden subir fotos para este tipo de contenido.'
    },
    {
        name: 'gallery limit',
        status: 422,
        error: {
            code: 'GALLERY_LIMIT_EXCEEDED',
            message: 'Gallery limit of 50 items reached for this entity',
            details: { entityType: 'accommodation', entityId: 'x', currentCount: 50, limit: 50 }
        },
        expectedEs: 'Llegaste al límite de 50 fotos de la galería.'
    },
    {
        name: 'missing file',
        status: 400,
        error: {
            code: 'VALIDATION_ERROR',
            reason: 'MISSING_FILE',
            message: 'Missing required "file" field'
        },
        expectedEs: 'No se recibió ninguna imagen. Elegí un archivo y probá de nuevo.'
    },
    {
        name: 'empty file',
        status: 422,
        error: { code: 'EMPTY_FILE', message: 'Uploaded file is empty' },
        expectedEs: 'El archivo está vacío. Elegí otra imagen.'
    }
];

describe('HOS-1218 — upload-entity refusals are shown in the host language', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearToasts();
        mockListMedia.mockReturnValue(Promise.resolve({ ok: true, data: { media: [] } }));
    });

    for (const slot of ['featured', 'gallery'] as const) {
        for (const c of CASES) {
            it(`${slot}: ${c.name} renders Spanish, not the English message or a raw key`, async () => {
                // Arrange
                mockUploadEntityImage.mockRejectedValue(
                    buildUploadEntityError({ body: { error: c.error }, status: c.status })
                );
                render(
                    <>
                        <PhotoSection {...props} />
                        <ToastViewport />
                    </>
                );
                await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
                const input = document.querySelector(`#${slot}-image-input`) as HTMLInputElement;
                expect(input).not.toBeNull();

                // Act
                fireEvent.change(input, {
                    target: { files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg' })] }
                });

                // Assert
                await waitFor(() => {
                    expect(screen.getAllByText(c.expectedEs).length).toBeGreaterThan(0);
                });
                expect(screen.queryByText(c.error.message)).not.toBeInTheDocument();
                expect(document.body.textContent ?? '').not.toContain('common.apiError');
            });
        }
    }
});
