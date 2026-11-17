/**
 * HOS-2324 — the MCP server declares the Hospeda icon in its `serverInfo`
 * (`icons`, MCP spec 2025-11-25), with an absolute URL built from the API URL.
 *
 * @module test/lib/brand-icon/server-icons
 */

import { InMemoryTransport, type JSONRPCMessage } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { buildBrandIcons } from '../../../src/lib/brand-icon/brand-icon';
import { createHospedaMcpServer } from '../../../src/lib/mcp/server';

const initializeServerInfo = async (apiUrl: string | undefined) => {
    const server = createHospedaMcpServer({ tools: [], apiUrl });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const received: JSONRPCMessage[] = [];
    clientSide.onmessage = (message) => received.push(message);
    await server.connect(serverSide);
    await clientSide.start();
    await clientSide.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' }
        }
    });
    await vi.waitFor(() => expect(received.length).toBeGreaterThan(0));
    await server.close();
    return (received[0] as unknown as { result: { serverInfo: Record<string, unknown> } }).result
        .serverInfo;
};

describe('MCP serverInfo icons', () => {
    it('declares an absolute https PNG icon built from the API URL', async () => {
        // Act
        const serverInfo = await initializeServerInfo('https://api.example.test');

        // Assert
        expect(serverInfo.icons).toEqual([
            { src: 'https://api.example.test/icon.png', mimeType: 'image/png', sizes: ['192x192'] }
        ]);
    });

    it('declares no icons when the API URL is not provided', async () => {
        // Act
        const serverInfo = await initializeServerInfo(undefined);

        // Assert
        expect(serverInfo.icons).toBeUndefined();
    });

    it('buildBrandIcons ignores a trailing slash on the API URL', () => {
        // Act
        const icons = buildBrandIcons({ apiUrl: 'https://api.example.test/' });

        // Assert
        expect(icons[0]?.src).toBe('https://api.example.test/icon.png');
    });
});
