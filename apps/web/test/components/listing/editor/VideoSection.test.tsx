import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VideoSection } from '@/components/listing/editor/VideoSection.client';

const useVideoSectionMock = vi.hoisted(() => ({
    rows: [{ url: 'https://youtube.com/watch?v=abc', caption: 'Recorrido' }],
    isDirty: true,
    isSaving: false,
    formError: null as string | null,
    addRow: vi.fn(),
    removeRow: vi.fn(),
    setRowField: vi.fn(),
    commit: vi.fn(),
    handleSubmit: vi.fn((e?: { preventDefault?: () => void }) => e?.preventDefault?.())
}));

vi.mock('@/lib/i18n', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/i18n')>()),
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

vi.mock('@/components/listing/editor/editor-fields.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => `fields-${String(prop)}`
    })
}));

vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

vi.mock('@/components/listing/editor/use-video-section', () => ({
    useVideoSection: () => useVideoSectionMock
}));

describe('VideoSection (shared widget)', () => {
    it('has no save button: the «Fotos» page auto-saves (HOS-2489)', () => {
        render(
            <VideoSection
                locale="es"
                initialVideos={[]}
                save={vi.fn()}
                copyScope="accommodation"
            />
        );

        expect(screen.getByRole('button', { name: 'Agregar video' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Guardar videos' })).toBeNull();
    });

    it('commits the list when a field loses focus', () => {
        useVideoSectionMock.commit.mockClear();
        render(
            <VideoSection
                locale="es"
                initialVideos={[]}
                save={vi.fn()}
                copyScope="accommodation"
            />
        );

        fireEvent.blur(screen.getByLabelText('Enlace del video'));
        fireEvent.blur(screen.getByLabelText('Título (opcional)'));

        expect(useVideoSectionMock.commit).toHaveBeenCalledTimes(2);
    });

    it('renders the video fields with the kit inputs, ids keyed by scope', () => {
        render(
            <VideoSection
                locale="es"
                initialVideos={[]}
                save={vi.fn()}
                copyScope="accommodation"
            />
        );

        expect(screen.getByLabelText('Enlace del video').id).toContain('acc');
        expect(screen.getByLabelText('Título (opcional)').id).toContain('acc');
    });

    it('wires add and remove actions through the video-specific controls', () => {
        render(
            <VideoSection
                locale="es"
                initialVideos={[]}
                save={vi.fn()}
                copyScope="accommodation"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Agregar video' }));
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar video 1' }));

        expect(useVideoSectionMock.addRow).toHaveBeenCalledTimes(1);
        expect(useVideoSectionMock.removeRow).toHaveBeenCalledWith(0);
    });

    it('shows a save failure as a kit alert', () => {
        useVideoSectionMock.formError = 'No se pudieron guardar los videos.';
        render(
            <VideoSection
                locale="es"
                initialVideos={[]}
                save={vi.fn()}
                copyScope="accommodation"
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron guardar los videos.');
        useVideoSectionMock.formError = null;
    });

    it('disables the add button once the cap is reached and keeps listing copy', () => {
        useVideoSectionMock.rows = Array.from({ length: 6 }, (_, i) => ({
            url: `https://youtube.com/watch?v=${i}`,
            caption: ''
        }));
        render(
            <VideoSection
                locale="es"
                initialVideos={[]}
                save={vi.fn()}
                copyScope="listing"
                maxVideos={6}
            />
        );

        expect(screen.getByRole('button', { name: 'Agregar video' })).toBeDisabled();
        expect(screen.getByText(/tu local/)).toBeInTheDocument();
    });

    it('renders inside the real editor card and labels the section by its heading', () => {
        render(
            <VideoSection
                locale="es"
                initialVideos={[]}
                save={vi.fn()}
                copyScope="listing"
            />
        );

        const region = screen.getByRole('region', { name: 'Videos' });
        expect(region.className).toBe('fields-section');
        expect(region.getAttribute('aria-labelledby')).toBe(
            screen.getByRole('heading', { name: 'Videos' }).id
        );
    });
});
