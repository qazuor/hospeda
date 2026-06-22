/**
 * @file AvatarUpload.test.tsx
 * @description Tests for the AvatarUpload React island — SPEC-183 T-006.
 *
 * Focus: API errors from /media/upload and /users/{id} PATCH are passed
 * through `translateApiError`, which means:
 *   - A known `code` (e.g. VALIDATION_ERROR) resolves to the localized
 *     translation via the mocked `t`, NOT the raw English message.
 *   - When no code is present the API `message` is used as fallback.
 *   - The localized fallback (already set before parsing the body) is
 *     returned when the response body cannot be parsed.
 *
 * The component is a client island that relies on:
 *   - `@/lib/i18n` → mocked to a stable `createTranslations` stub
 *   - `@/lib/api-errors` → mocked so we can inspect `translateApiError` calls
 *   - `@repo/icons` → mocked to null renders
 *   - `@repo/media` → mocked to identity (returns url as-is)
 *   - CSS module → proxy
 *   - `@/lib/avatar-utils` → mocked to return "TU"
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarUpload } from '../../../src/components/account/AvatarUpload.client';

// ─── jsdom polyfills ──────────────────────────────────────────────────────────

// jsdom does not implement URL.createObjectURL / revokeObjectURL.
if (typeof URL.createObjectURL === 'undefined') {
    URL.createObjectURL = vi.fn(() => 'blob:mock-object-url');
}
if (typeof URL.revokeObjectURL === 'undefined') {
    URL.revokeObjectURL = vi.fn();
}

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/AvatarUpload.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

/**
 * Stable t stub: for `common.apiError.<CODE>` keys, return a recognisably
 * localized string prefixed with `[es]` so tests can verify the translated
 * path was taken vs. the raw English message path.
 */
const mockT = vi.fn((key: string, fallback?: string): string => {
    if (key.startsWith('common.apiError.')) {
        const code = key.replace('common.apiError.', '');
        return `[es] ${code}`;
    }
    return fallback ?? key;
});

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({ t: mockT })
}));

vi.mock('../../../src/lib/api-errors', async () => {
    // Use the real implementation so the full priority chain is exercised.
    const real = await vi.importActual<typeof import('../../../src/lib/api-errors')>(
        '../../../src/lib/api-errors'
    );
    return real;
});

vi.mock('@repo/icons', () => ({
    ImageIcon: () => null,
    UploadIcon: () => null
}));

vi.mock('@repo/media', () => ({
    getMediaUrl: (url: string) => url
}));

vi.mock('../../../src/lib/avatar-utils', () => ({
    getInitials: () => 'TU'
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
    userId: 'user-123',
    apiUrl: 'http://api.test',
    locale: 'es' as const
} as const;

function makeFile(type = 'image/png', size = 100): File {
    const blob = new Blob(['x'.repeat(size)], { type });
    return new File([blob], 'avatar.png', { type });
}

async function triggerFileChange(file: File): Promise<void> {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AvatarUpload — translateApiError integration (T-006)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Upload endpoint: known code → localized text ───────────────────────

    it('shows localized message (not raw English) when upload fails with a known code', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                error: { code: 'VALIDATION_ERROR', message: 'Validation failed (English)' }
            })
        } as Response);

        render(<AvatarUpload {...DEFAULT_PROPS} />);
        await triggerFileChange(makeFile());

        await waitFor(() => {
            // The translated string returned by our mockT for VALIDATION_ERROR
            expect(screen.getByRole('alert')).toHaveTextContent('[es] VALIDATION_ERROR');
        });

        // Sanity: the raw English message was NOT shown
        expect(screen.getByRole('alert').textContent).not.toContain('Validation failed (English)');
    });

    // ── Upload endpoint: no code → API message used as-is ─────────────────

    it('shows the API message when the upload error has no code', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                error: { message: 'Storage quota exceeded' }
            })
        } as Response);

        render(<AvatarUpload {...DEFAULT_PROPS} />);
        await triggerFileChange(makeFile());

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Storage quota exceeded');
        });
    });

    // ── Upload endpoint: body unparseable → localized fallback ────────────

    it('shows the localized fallback when the upload error body cannot be parsed', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: false,
            json: async () => {
                throw new SyntaxError('not json');
            }
        } as unknown as Response);

        render(<AvatarUpload {...DEFAULT_PROPS} />);
        await triggerFileChange(makeFile());

        await waitFor(() => {
            // The fallback is t('account.avatar.errors.uploadFailed') which our
            // stub returns as the fallback string verbatim.
            expect(screen.getByRole('alert')).toHaveTextContent(/upload/i);
        });
    });

    // ── PATCH endpoint: known code → localized text ────────────────────────

    it('shows localized message (not raw English) when the profile PATCH fails with a known code', async () => {
        // First call succeeds (upload), second call fails (PATCH users/{id})
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: { url: 'https://cdn.test/a.png' } })
            } as Response)
            .mockResolvedValueOnce({
                ok: false,
                json: async () => ({
                    error: { code: 'NOT_FOUND', message: 'User not found (English)' }
                })
            } as Response);

        render(<AvatarUpload {...DEFAULT_PROPS} />);
        await triggerFileChange(makeFile());

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('[es] NOT_FOUND');
        });

        expect(screen.getByRole('alert').textContent).not.toContain('User not found (English)');
    });

    // ── PATCH endpoint: no code → API message ─────────────────────────────

    it('shows the API message when the PATCH error has no code', async () => {
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: { url: 'https://cdn.test/a.png' } })
            } as Response)
            .mockResolvedValueOnce({
                ok: false,
                json: async () => ({
                    error: { message: 'Profile locked by admin' }
                })
            } as Response);

        render(<AvatarUpload {...DEFAULT_PROPS} />);
        await triggerFileChange(makeFile());

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Profile locked by admin');
        });
    });

    // ── reason takes priority over code ───────────────────────────────────

    it('prefers error.reason over error.code when both are present', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    reason: 'NEWSLETTER_NOT_CONFIGURED',
                    message: 'Service unavailable (English)'
                }
            })
        } as Response);

        render(<AvatarUpload {...DEFAULT_PROPS} />);
        await triggerFileChange(makeFile());

        await waitFor(() => {
            // reason wins → '[es] NEWSLETTER_NOT_CONFIGURED'
            expect(screen.getByRole('alert')).toHaveTextContent('[es] NEWSLETTER_NOT_CONFIGURED');
        });
    });
});
