/**
 * Tests for the CIMD allowlist (`isMcpCimdUrlAllowed`) and transport
 * (`mcpCimdFetch`) of the MCP authorization server (HOS-2184).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSafeFetch } = vi.hoisted(() => ({ mockSafeFetch: vi.fn() }));
vi.mock('@repo/utils/safe-fetch', () => ({ safeExternalFetch: mockSafeFetch }));

import {
    MCP_CIMD_FETCH_TIMEOUT_MS,
    MCP_CIMD_MAX_BYTES,
    mcpCimdFetch
} from '../../src/lib/auth-mcp-cimd-fetch';
import { isMcpCimdUrlAllowed } from '../../src/lib/auth-mcp-oauth';

describe('isMcpCimdUrlAllowed', () => {
    it.each([
        'https://claude.ai/oauth/mcp-client-metadata',
        'https://claude.com/oauth/client.json',
        'https://chatgpt.com/oauth/client.json'
    ])('allows %s', (url) => {
        expect(isMcpCimdUrlAllowed(url)).toBe(true);
    });

    it.each([
        ['plain http', 'http://claude.ai/oauth/client.json'],
        ['a foreign host', 'https://evil.example/client.json'],
        ['a subdomain of an allowed host', 'https://sub.claude.ai/client.json'],
        ['a lookalike host', 'https://claude.ai.evil.example/client.json'],
        ['a private IPv4', 'https://10.0.0.1/client.json'],
        ['the cloud metadata IP', 'https://169.254.169.254/latest/meta-data'],
        ['loopback', 'https://127.0.0.1/client.json'],
        ['credentials in the URL', 'https://user:pass@claude.ai/client.json'],
        ['a non-default port', 'https://claude.ai:8443/client.json'],
        ['not a URL', 'not a url']
    ])('refuses %s', (_label, url) => {
        expect(isMcpCimdUrlAllowed(url)).toBe(false);
    });
});

describe('mcpCimdFetch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches through safeExternalFetch with a timeout, a size cap and no redirects', async () => {
        mockSafeFetch.mockResolvedValue({
            ok: true,
            status: 200,
            body: '{"client_id":"x"}',
            finalUrl: 'https://claude.ai/c.json'
        });

        const res = await mcpCimdFetch('https://claude.ai/c.json', {
            headers: { accept: 'application/json' }
        });

        expect(mockSafeFetch).toHaveBeenCalledWith({
            url: 'https://claude.ai/c.json',
            timeoutMs: MCP_CIMD_FETCH_TIMEOUT_MS,
            maxBytes: MCP_CIMD_MAX_BYTES,
            maxRedirects: 0,
            headers: { accept: 'application/json' }
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ client_id: 'x' });
    });

    it('rejects when safeExternalFetch blocks the target (private IP, size, timeout)', async () => {
        mockSafeFetch.mockResolvedValue({
            ok: false,
            status: 0,
            error: 'private address blocked',
            blocked: true
        });

        await expect(mcpCimdFetch('https://10.0.0.1/c.json')).rejects.toThrow(/refused/);
    });

    it('rejects a method other than GET and HEAD without fetching', async () => {
        await expect(mcpCimdFetch('https://claude.ai/c.json', { method: 'POST' })).rejects.toThrow(
            /POST/
        );
        expect(mockSafeFetch).not.toHaveBeenCalled();
    });
});
