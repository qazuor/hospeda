/**
 * HOS-2184 T-010 — packing the Hospeda caller into the SDK `authInfo` and
 * reading it back inside a tool.
 */

import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import { buildMcpAuthInfo, getMcpCaller, MCP_CALLER_EXTRA_KEY } from '../../../src/lib/mcp/caller';
import type { McpAuthContext } from '../../../src/types';

const ACTOR = {
    id: '43a7b0fb-bde8-4109-a553-1134f2f917fd',
    roles: [],
    permissions: []
} as unknown as Actor;

const MCP_AUTH: McpAuthContext = {
    userId: ACTOR.id,
    clientId: 'https://claude.ai/oauth/mcp-client-metadata',
    clientName: 'Claude',
    scopes: ['openid', 'offline_access']
};

describe('buildMcpAuthInfo', () => {
    it('maps the grant onto the SDK fields and carries the caller in extra', () => {
        // Act
        const authInfo = buildMcpAuthInfo({
            token: 'access-token',
            actor: ACTOR,
            mcpAuth: MCP_AUTH,
            resourceUrl: 'https://api.test/mcp'
        });

        // Assert
        expect(authInfo.token).toBe('access-token');
        expect(authInfo.clientId).toBe(MCP_AUTH.clientId);
        expect(authInfo.scopes).toEqual(['openid', 'offline_access']);
        expect(authInfo.resource?.href).toBe('https://api.test/mcp');
        expect(authInfo.extra?.[MCP_CALLER_EXTRA_KEY]).toEqual({
            actor: ACTOR,
            mcpAuth: MCP_AUTH
        });
    });
});

describe('getMcpCaller', () => {
    it('returns the caller packed by buildMcpAuthInfo', () => {
        // Arrange
        const authInfo = buildMcpAuthInfo({
            token: 'access-token',
            actor: ACTOR,
            mcpAuth: MCP_AUTH,
            resourceUrl: 'https://api.test/mcp'
        });

        // Act
        const caller = getMcpCaller({ ctx: { http: { authInfo } } });

        // Assert
        expect(caller).toEqual({ actor: ACTOR, mcpAuth: MCP_AUTH });
    });

    it.each([
        ['no http context (stdio)', {}],
        ['no authInfo', { http: {} }],
        [
            'authInfo without the caller',
            { http: { authInfo: { token: 't', clientId: 'c', scopes: [] } } }
        ],
        [
            'a caller without an actor id',
            {
                http: {
                    authInfo: {
                        token: 't',
                        clientId: 'c',
                        scopes: [],
                        extra: { [MCP_CALLER_EXTRA_KEY]: { actor: {}, mcpAuth: MCP_AUTH } }
                    }
                }
            }
        ]
    ])('throws when the context has %s', (_label, ctx) => {
        // Act
        const act = () => getMcpCaller({ ctx });

        // Assert
        expect(act).toThrow('MCP request has no authenticated Hospeda caller');
    });
});
