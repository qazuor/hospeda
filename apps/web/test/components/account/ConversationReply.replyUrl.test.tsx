/**
 * @file ConversationReply.replyUrl.test.tsx
 * @description Tests for the ConversationReply component's replyUrl prop
 * (SPEC-206 PR2). Verifies that an optional replyUrl prop overrides the
 * default endpoint URL construction.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConversationReply } from '../../../src/components/account/ConversationReply.client';

// Mock getApiUrl to return a predictable base URL
vi.mock('@/lib/env', () => ({
    getApiUrl: () => 'http://localhost:3001'
}));

describe('ConversationReply — replyUrl prop (SPEC-206)', () => {
    it('renders the reply form with textarea and submit button', () => {
        render(
            <ConversationReply
                mode="auth"
                conversationId="conv-123"
                locale="es"
            />
        );

        expect(screen.getByPlaceholderText(/escribí tu respuesta/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
    });

    it('has a textarea with accessible label', () => {
        render(
            <ConversationReply
                mode="auth"
                conversationId="conv-123"
                locale="es"
            />
        );

        const textarea = screen.getByPlaceholderText(/escribí tu respuesta/i);
        expect(textarea).toBeInTheDocument();
    });

    it('accepts an optional replyUrl prop without type errors', () => {
        // This test verifies the prop is part of the component's type signature.
        // If replyUrl were not in the props type, this would cause a TS error.
        render(
            <ConversationReply
                mode="auth"
                conversationId="conv-123"
                locale="es"
                replyUrl="http://localhost:3001/api/v1/protected/conversations/owner/conv-123/messages"
            />
        );

        expect(screen.getByPlaceholderText(/escribí tu respuesta/i)).toBeInTheDocument();
    });

    it('renders without replyUrl (backward compatible default)', () => {
        render(
            <ConversationReply
                mode="auth"
                conversationId="conv-456"
                locale="es"
            />
        );

        expect(screen.getByPlaceholderText(/escribí tu respuesta/i)).toBeInTheDocument();
    });

    it('guest mode still works without replyUrl', () => {
        render(
            <ConversationReply
                mode="guest"
                token="tok-abc"
                locale="es"
            />
        );

        expect(screen.getByPlaceholderText(/escribí tu respuesta/i)).toBeInTheDocument();
    });

    it('calls fetch with custom replyUrl when provided', async () => {
        const user = userEvent.setup();
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({ id: 'msg-1', body: 'test' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            })
        );

        render(
            <ConversationReply
                mode="auth"
                conversationId="conv-789"
                locale="es"
                replyUrl="http://localhost:3001/api/v1/protected/conversations/owner/conv-789/messages"
            />
        );

        const textarea = screen.getByPlaceholderText(/escribí tu respuesta/i);
        await user.type(textarea, 'Hola desde owner');
        await user.click(screen.getByRole('button', { name: /enviar/i }));

        // Verify fetch was called with the custom replyUrl
        expect(fetchSpy).toHaveBeenCalledWith(
            'http://localhost:3001/api/v1/protected/conversations/owner/conv-789/messages',
            expect.objectContaining({
                method: 'POST',
                credentials: 'include'
            })
        );

        fetchSpy.mockRestore();
    });

    it('calls fetch with default auth URL when replyUrl is not provided', async () => {
        const user = userEvent.setup();
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({ id: 'msg-2', body: 'test' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            })
        );

        render(
            <ConversationReply
                mode="auth"
                conversationId="conv-default"
                locale="es"
            />
        );

        const textarea = screen.getByPlaceholderText(/escribí tu respuesta/i);
        await user.type(textarea, 'Respuesta default');
        await user.click(screen.getByRole('button', { name: /enviar/i }));

        // Verify fetch was called with the default auth URL
        expect(fetchSpy).toHaveBeenCalledWith(
            'http://localhost:3001/api/v1/protected/conversations/conv-default/messages',
            expect.objectContaining({
                method: 'POST',
                credentials: 'include'
            })
        );

        fetchSpy.mockRestore();
    });
});
