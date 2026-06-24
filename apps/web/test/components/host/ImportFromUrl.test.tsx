/**
 * @file ImportFromUrl.test.tsx
 * @description Component tests for the ImportFromUrl host island (SPEC-222 T-023):
 * the submit button is gated on the legal checkbox (AC-1.1) and a valid submit
 * calls the import endpoint with the validated request body.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

    it('toggles the URL-acquisition help panel (US-7)', () => {
        // Arrange
        render(<ImportFromUrl locale="es" />);
        expect(screen.queryByText(/Cómo copiar la URL/i)).not.toBeInTheDocument();

        // Act: open the help panel.
        fireEvent.click(screen.getByRole('button', { name: /Cómo obtengo la URL/i }));

        // Assert: title + the four platforms are listed.
        expect(screen.getByText(/Cómo copiar la URL/i)).toBeInTheDocument();
        expect(screen.getByText('airbnb')).toBeInTheDocument();
        expect(screen.getByText('booking')).toBeInTheDocument();
        expect(screen.getByText('mercadolibre')).toBeInTheDocument();
        expect(screen.getByText('google')).toBeInTheDocument();
    });
});

describe('ImportFromUrl — failureCode branch (SPEC-258 C.1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /** Helper: fill URL, tick legal, click submit, wait for mock to resolve. */
    async function submitWithFailureCode(failureCode: string) {
        mockImportFromUrl.mockResolvedValueOnce({
            ok: true,
            data: {
                draft: {},
                source: 'generic',
                methodsUsed: [],
                partial: false,
                failureCode
            }
        });
        const onImported = vi.fn();
        const onError = vi.fn();
        render(
            <ImportFromUrl
                locale="es"
                onImported={onImported}
                onError={onError}
            />
        );

        fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo/i }));
        fireEvent.change(screen.getByRole('textbox', { name: /URL/i }), {
            target: { value: 'https://www.airbnb.com.ar/rooms/123' }
        });
        fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

        // Wait for async submission to complete
        await waitFor(() => expect(mockImportFromUrl).toHaveBeenCalledTimes(1));

        return { onImported, onError };
    }

    it.each([
        ['invalid_url', 'invalid_url'],
        ['source_blocked', 'source_blocked'],
        ['credentials_missing', 'credentials_missing'],
        ['provider_error', 'provider_error'],
        ['timeout', 'timeout'],
        ['nothing_found', 'nothing_found']
    ])(
        'renders an error alert (not a success notice) for failureCode "%s"',
        async (failureCode) => {
            // Arrange + Act
            const { onImported, onError } = await submitWithFailureCode(failureCode);

            // Assert: error alert is shown
            const alert = await screen.findByRole('alert');
            expect(alert).toBeInTheDocument();

            // Assert: onImported was NOT called
            expect(onImported).not.toHaveBeenCalled();

            // Assert: onError was called with the failureCode
            await waitFor(() => expect(onError).toHaveBeenCalledWith(failureCode));
        }
    );

    it('does NOT render a success notice when failureCode is present', async () => {
        // Arrange
        mockImportFromUrl.mockResolvedValueOnce({
            ok: true,
            data: {
                draft: {},
                source: 'generic',
                methodsUsed: [],
                partial: false,
                failureCode: 'nothing_found',
                message: 'some server message'
            }
        });
        render(<ImportFromUrl locale="es" />);

        // Act
        fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo/i }));
        fireEvent.change(screen.getByRole('textbox', { name: /URL/i }), {
            target: { value: 'https://www.airbnb.com.ar/rooms/123' }
        });
        fireEvent.click(screen.getByRole('button', { name: /Importar/i }));

        // Assert: wait for error alert to appear, then verify no <output> notice
        await screen.findByRole('alert');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});

describe('ImportFromUrl i18n keys', () => {
    const localesDir = resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../../packages/i18n/src/locales'
    );

    for (const locale of ['es', 'en', 'pt'] as const) {
        it(`defines the importFromUrl.* keys in ${locale}/host.json`, () => {
            // Arrange
            const host = JSON.parse(
                readFileSync(resolve(localesDir, locale, 'host.json'), 'utf8')
            ) as Record<string, unknown>;

            // Act
            const block = host.importFromUrl as
                | {
                      fields?: Record<string, string>;
                      actions?: Record<string, string>;
                      errors?: {
                          urlInvalid?: string;
                          failure?: Record<string, string>;
                      };
                      help?: {
                          toggle?: string;
                          title?: string;
                          platforms?: Record<
                              string,
                              { name?: string; steps?: string; example?: string }
                          >;
                      };
                  }
                | undefined;

            // Assert
            expect(block).toBeDefined();
            expect(block?.fields?.url).toBeTruthy();
            expect(block?.fields?.legalConfirm).toBeTruthy();
            expect(block?.actions?.submit).toBeTruthy();
            expect(block?.errors?.urlInvalid).toBeTruthy();
            // SPEC-258 C.1: every failure-mode key must exist in each locale so a
            // classified failure always resolves to localized text.
            for (const key of [
                'invalidUrl',
                'sourceBlocked',
                'credentialsMissing',
                'providerError',
                'timeout',
                'nothingFound'
            ]) {
                expect(block?.errors?.failure?.[key]).toBeTruthy();
            }
            expect(block?.help?.toggle).toBeTruthy();
            for (const platform of ['airbnb', 'booking', 'mercadolibre', 'google']) {
                const entry = block?.help?.platforms?.[platform];
                expect(entry?.name).toBeTruthy();
                expect(entry?.steps).toBeTruthy();
                expect(entry?.example).toBeTruthy();
            }
        });
    }
});
