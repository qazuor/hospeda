/**
 * Unit tests for recordMcpToolCall (HOS-2184 T-011).
 *
 * @module test/lib/mcp/record-tool-call
 */

const { mockAuditLog, mockLoggerError } = vi.hoisted(() => ({
    mockAuditLog: vi.fn(),
    mockLoggerError: vi.fn()
}));

vi.mock('../../../src/utils/audit-logger', () => ({
    AuditEventType: { MCP_TOOL_CALL: 'mcp.tool.call' },
    auditLog: mockAuditLog
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { recordMcpToolCall } from '../../../src/lib/mcp/record-tool-call';

const actor = { id: '11111111-1111-4111-8111-111111111111' };
const mcpAuth = { clientId: 'https://client.example/meta.json', clientName: 'Claude' };

describe('recordMcpToolCall', () => {
    beforeEach(() => {
        mockAuditLog.mockReset();
        mockLoggerError.mockReset();
    });

    it('should write the full payload for a success with target and content length', () => {
        recordMcpToolCall({
            actor,
            mcpAuth,
            tool: 'reply_to_conversation',
            target: { type: 'conversation', id: 'conv-1' },
            outcome: 'success',
            contentLength: 42
        });

        expect(mockAuditLog).toHaveBeenCalledTimes(1);
        expect(mockAuditLog).toHaveBeenCalledWith({
            auditEvent: 'mcp.tool.call',
            actorId: actor.id,
            clientId: mcpAuth.clientId,
            clientName: 'Claude',
            tool: 'reply_to_conversation',
            resourceType: 'conversation',
            resourceId: 'conv-1',
            outcome: 'success',
            contentLength: 42
        });
    });

    it('should include the error code for a denied outcome', () => {
        recordMcpToolCall({
            actor,
            mcpAuth,
            tool: 'update_listing',
            target: { type: 'accommodation', id: 'acc-1' },
            outcome: 'denied',
            errorCode: 'FORBIDDEN'
        });

        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'denied', errorCode: 'FORBIDDEN' })
        );
    });

    it('should include the error code for an error outcome and keep a null client name', () => {
        recordMcpToolCall({
            actor,
            mcpAuth: { clientId: 'dcr-1', clientName: null },
            tool: 'update_listing',
            outcome: 'error',
            errorCode: 'INTERNAL_ERROR'
        });

        const payload = mockAuditLog.mock.calls[0]?.[0];
        expect(payload).toMatchObject({
            clientName: null,
            outcome: 'error',
            errorCode: 'INTERNAL_ERROR'
        });
        expect(payload).not.toHaveProperty('resourceType');
        expect(payload).not.toHaveProperty('resourceId');
        expect(payload).not.toHaveProperty('contentLength');
    });

    it('should log and not throw when the audit write fails', () => {
        mockAuditLog.mockImplementation(() => {
            throw new Error('sink down');
        });

        expect(() =>
            recordMcpToolCall({ actor, mcpAuth, tool: 'list_listings', outcome: 'success' })
        ).not.toThrow();
        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({
                tool: 'list_listings',
                clientId: mcpAuth.clientId,
                error: 'sink down'
            }),
            expect.any(String)
        );
    });

    it('should not throw when the failure logger throws too', () => {
        mockAuditLog.mockImplementation(() => {
            throw new Error('sink down');
        });
        mockLoggerError.mockImplementation(() => {
            throw new Error('logger down');
        });

        expect(() =>
            recordMcpToolCall({ actor, mcpAuth, tool: 'list_listings', outcome: 'success' })
        ).not.toThrow();
    });
});
