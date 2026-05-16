/**
 * @file ProfileCompletionAvatarPicker.test.tsx
 * @description Tests for the profile completion avatar picker (SPEC-113).
 *
 * Covers:
 *   - Button click triggers the hidden file input
 *   - Invalid file type / oversized file reports an error and does NOT upload
 *   - Successful upload calls onUploaded(url) with the URL from the API
 *   - Upload failure reports a translated error and does NOT call onUploaded
 *   - The picker is disabled when the parent reports `disabled={true}`
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileCompletionAvatarPicker } from '../../../src/components/account/ProfileCompletionAvatarPicker';

/** Minimal translation stub — returns the fallback verbatim. */
const t = (_key: string, fallback: string) => fallback;

const API_URL = 'http://api.test';

function makeFile(opts: { name?: string; type: string; size?: number } = { type: 'image/png' }) {
    const blob = new Blob(['x'.repeat(opts.size ?? 8)], { type: opts.type });
    return new File([blob], opts.name ?? 'avatar.png', { type: opts.type });
}

describe('ProfileCompletionAvatarPicker', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('renders the change button with the default label', () => {
        render(
            <ProfileCompletionAvatarPicker
                apiUrl={API_URL}
                disabled={false}
                t={t}
                onUploaded={() => {}}
            />
        );
        expect(screen.getByRole('button', { name: /cambiar foto/i })).toBeInTheDocument();
    });

    it('clicking the button triggers a click on the hidden file input', () => {
        render(
            <ProfileCompletionAvatarPicker
                apiUrl={API_URL}
                disabled={false}
                t={t}
                onUploaded={() => {}}
            />
        );

        const fileInput = document.querySelector(
            'input#pc-avatar-upload'
        ) as HTMLInputElement | null;
        expect(fileInput).not.toBeNull();
        const clickSpy = vi.spyOn(fileInput!, 'click');

        fireEvent.click(screen.getByRole('button', { name: /cambiar foto/i }));
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('reports an error and does NOT upload when the file type is invalid', async () => {
        const onUploaded = vi.fn();
        const onError = vi.fn();
        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        render(
            <ProfileCompletionAvatarPicker
                apiUrl={API_URL}
                disabled={false}
                t={t}
                onUploaded={onUploaded}
                onError={onError}
            />
        );

        const fileInput = document.querySelector('input#pc-avatar-upload') as HTMLInputElement;
        const badFile = makeFile({ type: 'application/pdf', name: 'doc.pdf' });

        fireEvent.change(fileInput, { target: { files: [badFile] } });

        await waitFor(() => {
            expect(onError).toHaveBeenCalledOnce();
        });
        expect(onUploaded).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(/imagen jpg, png o webp/i);
    });

    it('reports an error and does NOT upload when the file exceeds 5 MB', async () => {
        const onUploaded = vi.fn();
        const onError = vi.fn();
        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        render(
            <ProfileCompletionAvatarPicker
                apiUrl={API_URL}
                disabled={false}
                t={t}
                onUploaded={onUploaded}
                onError={onError}
            />
        );

        const fileInput = document.querySelector('input#pc-avatar-upload') as HTMLInputElement;
        const bigFile = makeFile({ type: 'image/png', size: 6 * 1024 * 1024 });

        fireEvent.change(fileInput, { target: { files: [bigFile] } });

        await waitFor(() => {
            expect(onError).toHaveBeenCalledOnce();
        });
        expect(onUploaded).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(/5 MB/);
    });

    it('on successful upload, calls onUploaded with the URL from the API', async () => {
        const onUploaded = vi.fn();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: { url: 'https://cdn.test/a.png' } })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        render(
            <ProfileCompletionAvatarPicker
                apiUrl={API_URL}
                disabled={false}
                t={t}
                onUploaded={onUploaded}
            />
        );

        const fileInput = document.querySelector('input#pc-avatar-upload') as HTMLInputElement;
        const file = makeFile({ type: 'image/png' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(onUploaded).toHaveBeenCalledWith('https://cdn.test/a.png');
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${API_URL}/api/v1/protected/media/upload`);
        expect(init.method).toBe('POST');
        expect(init.credentials).toBe('include');
        expect(init.body).toBeInstanceOf(FormData);
    });

    it('on upload failure, reports an error and does NOT call onUploaded', async () => {
        const onUploaded = vi.fn();
        const onError = vi.fn();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: { message: 'Upload exploded' } })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        render(
            <ProfileCompletionAvatarPicker
                apiUrl={API_URL}
                disabled={false}
                t={t}
                onUploaded={onUploaded}
                onError={onError}
            />
        );

        const fileInput = document.querySelector('input#pc-avatar-upload') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: [makeFile({ type: 'image/png' })] } });

        await waitFor(() => {
            expect(onError).toHaveBeenCalledWith('Upload exploded');
        });
        expect(onUploaded).not.toHaveBeenCalled();
    });

    it('disables the button when the parent says disabled', () => {
        render(
            <ProfileCompletionAvatarPicker
                apiUrl={API_URL}
                disabled={true}
                t={t}
                onUploaded={() => {}}
            />
        );
        expect(screen.getByRole('button', { name: /cambiar foto/i })).toBeDisabled();
    });
});
