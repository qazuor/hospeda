import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VideoSection } from '@/components/host/editor/VideoSection.client';

const useVideoSectionMock = vi.hoisted(() => ({
    rows: [{ url: 'https://youtube.com/watch?v=abc', caption: 'Recorrido' }],
    isDirty: true,
    isSaving: false,
    formError: null as string | null,
    addRow: vi.fn(),
    removeRow: vi.fn(),
    setRowField: vi.fn(),
    handleSubmit: vi.fn((e?: { preventDefault?: () => void }) => e?.preventDefault?.())
}));

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw = fallback ?? key;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                raw
            );
        }
    })
}));

vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

vi.mock('@/components/host/editor/use-video-section', () => ({
    useVideoSection: () => useVideoSectionMock
}));

describe('VideoSection', () => {
    it('uses dedicated button classes instead of the photo upload styles', () => {
        render(
            <VideoSection
                locale="es"
                accommodationId="acc-1"
                initialVideos={[]}
            />
        );

        expect(screen.getByRole('button', { name: 'Agregar video' }).className).toContain(
            'videoAddButton'
        );
        expect(screen.getByRole('button', { name: 'Guardar videos' }).className).toContain(
            'videoSaveButton'
        );
    });

    it('renders the video fields with the shared form input styling', () => {
        render(
            <VideoSection
                locale="es"
                accommodationId="acc-1"
                initialVideos={[]}
            />
        );

        expect(screen.getByLabelText('Enlace del video').className).toContain('formInput');
        expect(screen.getByLabelText('Título (opcional)').className).toContain('formInput');
    });

    it('wires add and remove actions through the video-specific controls', () => {
        render(
            <VideoSection
                locale="es"
                accommodationId="acc-1"
                initialVideos={[]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Agregar video' }));
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar video 1' }));

        expect(useVideoSectionMock.addRow).toHaveBeenCalledTimes(1);
        expect(useVideoSectionMock.removeRow).toHaveBeenCalledWith(0);
    });
});
