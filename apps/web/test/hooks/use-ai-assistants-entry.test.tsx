/**
 * @file use-ai-assistants-entry.test.tsx
 * @description Visibility rule of the "Asistentes de IA" entry (HOS-2184 T-028):
 * flag on shows it, flag off or unknown follows the connection count, errors
 * hide it, and every menu shares one request.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiAssistantsEntry } from '../../src/hooks/use-ai-assistants-entry';
import { resetAiConnectionCount } from '../../src/lib/ai-connections-count';

vi.mock('../../src/lib/env', () => ({ getApiUrl: () => 'https://api.x' }));

const item = {
    clientId: 'c',
    name: null,
    uri: null,
    logoUri: null,
    scopes: [],
    connectedAt: null,
    lastUsedAt: null
};

function answer(items: readonly object[]): Response {
    return { ok: true, json: async () => ({ success: true, data: { items } }) } as Response;
}

describe('useAiAssistantsEntry', () => {
    beforeEach(() => {
        resetAiConnectionCount();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('flag on: shown, and no lookup is made', () => {
        const { result } = renderHook(() =>
            useAiAssistantsEntry({ mcpEnabled: true, enabled: true })
        );

        expect(result.current).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('flag off with 0 connections: hidden', async () => {
        vi.mocked(fetch).mockResolvedValue(answer([]));
        const { result } = renderHook(() =>
            useAiAssistantsEntry({ mcpEnabled: false, enabled: true })
        );

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        expect(result.current).toBe(false);
    });

    it('flag off with 1 or more connections: shown', async () => {
        vi.mocked(fetch).mockResolvedValue(answer([item]));
        const { result } = renderHook(() =>
            useAiAssistantsEntry({ mcpEnabled: false, enabled: true })
        );

        await waitFor(() => expect(result.current).toBe(true));
    });

    it('flag unknown falls back to the connection count', async () => {
        vi.mocked(fetch).mockResolvedValue(answer([item]));
        const { result } = renderHook(() => useAiAssistantsEntry({ enabled: true }));

        await waitFor(() => expect(result.current).toBe(true));
    });

    it('fetch error: hidden', async () => {
        vi.mocked(fetch).mockRejectedValue(new Error('down'));
        const { result } = renderHook(() =>
            useAiAssistantsEntry({ mcpEnabled: false, enabled: true })
        );

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        await Promise.resolve();
        expect(result.current).toBe(false);
    });

    it('a guest never triggers a lookup', () => {
        const { result } = renderHook(() =>
            useAiAssistantsEntry({ mcpEnabled: false, enabled: false })
        );

        expect(result.current).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('three menus on one page share a single request', async () => {
        vi.mocked(fetch).mockResolvedValue(answer([item]));
        const sidebar = renderHook(() =>
            useAiAssistantsEntry({ mcpEnabled: false, enabled: true })
        );
        const avatar = renderHook(() => useAiAssistantsEntry({ mcpEnabled: false, enabled: true }));
        const mobile = renderHook(() => useAiAssistantsEntry({ enabled: true }));

        await waitFor(() => {
            expect(sidebar.result.current).toBe(true);
            expect(avatar.result.current).toBe(true);
            expect(mobile.result.current).toBe(true);
        });
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
