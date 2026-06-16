/**
 * @file ImportFromUrl.test.tsx
 * @description Component tests for the ImportFromUrl host island (SPEC-222 T-023):
 * the submit button is gated on the legal checkbox (AC-1.1) and a valid submit
 * calls the import endpoint with the validated request body.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockImportFromUrl } = vi.hoisted(() => ({ mockImportFromUrl: vi.fn() }));

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationsImportApi: {
        importFromUrl: (...args: unknown[]) => mockImportFromUrl(...args)
    }
}));

import { ImportFromUrl } from '../../../src/components/host/ImportFromUrl.client';

describe('ImportFromUrl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps the Importar button disabled until the legal checkbox is ticked', () => {
        // Arrange
        render(<ImportFromUrl locale="es" />);
        const button = screen.getByRole('button', { name: /Importar/i });

        // Assert (initial)
        expect(button).toBeDisabled();

        // Act
        fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo/i }));

        // Assert
        expect(button).not.toBeDisabled();
    });

    it('calls the import endpoint with the validated body on a valid submit', async () => {
        // Arrange
        mockImportFromUrl.mockResolvedValueOnce({
            ok: true,
            data: { draft: {}, source: 'generic', methodsUsed: [], partial: true }
        });
        const onImported = vi.fn();
        render(
            <ImportFromUrl
                locale="es"
                onImported={onImported}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo/i }));
        fireEvent.change(screen.getByRole('textbox', { name: /URL/i }), {
            target: { value: 'https://www.airbnb.com.ar/rooms/123' }
        });
        fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

        // Assert
        await waitFor(() => {
            expect(mockImportFromUrl).toHaveBeenCalledWith({
                url: 'https://www.airbnb.com.ar/rooms/123',
                locale: 'es',
                legalConfirmed: true
            });
        });
        await waitFor(() => {
            expect(onImported).toHaveBeenCalledTimes(1);
        });
    });

    it('shows an error and does not call the endpoint when the URL is empty', async () => {
        // Arrange
        render(<ImportFromUrl locale="es" />);

        // Act: tick legal, leave URL empty, submit.
        fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo/i }));
        fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

        // Assert
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(mockImportFromUrl).not.toHaveBeenCalled();
    });

    it('surfaces a server notice from the response message', async () => {
        // Arrange
        mockImportFromUrl.mockResolvedValueOnce({
            ok: true,
            data: {
                draft: {},
                source: 'generic',
                methodsUsed: [],
                partial: true,
                message: 'La extracción asistida por IA no está incluida en tu plan.'
            }
        });
        render(<ImportFromUrl locale="es" />);

        // Act
        fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo/i }));
        fireEvent.change(screen.getByRole('textbox', { name: /URL/i }), {
            target: { value: 'https://example.com/listing/1' }
        });
        fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

        // Assert
        expect(await screen.findByRole('status')).toHaveTextContent(/no está incluida en tu plan/i);
    });
});
