/**
 * @file useAccommodationChat.ts
 * @description React hook for the AI accommodation chat widget.
 * Manages the state machine: idle → streaming → done/error/at_cap.
 * Tracks token accumulation, hasPartialContent for moderation UX,
 * price-disclaimer marker stripping, and conversationId.
 *
 * @module useAccommodationChat
 */

import { streamChat } from '@/lib/api/ai-chat-stream';
import type { SseEvent } from '@/lib/api/ai-chat-stream';
import { useCallback, useRef, useState } from 'react';

const PRICE_DISCLAIMER_MARKER = '---price-disclaimer---';
const MAX_MESSAGES = 20;

export type ChatStatus = 'idle' | 'streaming' | 'error' | 'at_cap';

export interface ChatMessage {
    readonly role: 'user' | 'assistant';
    readonly content: string;
}

export interface ChatState {
    readonly messages: ChatMessage[];
    readonly currentAssistantContent: string;
    readonly hasPartialContent: boolean;
    readonly conversationId: string | null;
    readonly status: ChatStatus;
    readonly errorMessage: string | null;
    readonly showPriceDisclaimer: boolean;
}

export interface UseAccommodationChatParams {
    readonly accommodationId: string;
    readonly locale: 'es' | 'en' | 'pt';
    readonly apiUrl: string;
}

export interface UseAccommodationChatReturn {
    readonly state: ChatState;
    readonly send: (text: string) => void;
    readonly abort: () => void;
    readonly reset: () => void;
}

const INITIAL_STATE: ChatState = {
    messages: [],
    currentAssistantContent: '',
    hasPartialContent: false,
    conversationId: null,
    status: 'idle',
    errorMessage: null,
    showPriceDisclaimer: false
};

/**
 * Hook that manages AI chat state for a single accommodation.
 *
 * @param params - Accommodation ID, locale, and API URL.
 * @returns Chat state, send/abort/reset controls.
 */
export function useAccommodationChat(
    params: UseAccommodationChatParams
): UseAccommodationChatReturn {
    const [state, setState] = useState<ChatState>(INITIAL_STATE);
    const abortControllerRef = useRef<AbortController | null>(null);
    const stateRef = useRef(state);
    stateRef.current = state;

    const send = useCallback(
        (text: string) => {
            const current = stateRef.current;
            const userMessage: ChatMessage = { role: 'user', content: text };
            const updatedMessages = [...current.messages, userMessage];

            setState({
                ...current,
                messages: updatedMessages,
                currentAssistantContent: '',
                hasPartialContent: false,
                status: 'streaming',
                errorMessage: null,
                showPriceDisclaimer: false
            });

            const controller = new AbortController();
            abortControllerRef.current = controller;

            void streamChat({
                apiUrl: params.apiUrl,
                accommodationId: params.accommodationId,
                messages: updatedMessages,
                locale: params.locale,
                conversationId: current.conversationId,
                signal: controller.signal,
                onEvent: (event: SseEvent) => {
                    setState((prev) => {
                        if (event.type === 'token') {
                            return {
                                ...prev,
                                currentAssistantContent: prev.currentAssistantContent + event.delta,
                                hasPartialContent: true
                            };
                        }

                        if (event.type === 'done') {
                            let content = prev.currentAssistantContent;
                            let showPriceDisclaimer = false;

                            if (content.includes(PRICE_DISCLAIMER_MARKER)) {
                                content = content.split(PRICE_DISCLAIMER_MARKER).join('').trimEnd();
                                showPriceDisclaimer = true;
                            }

                            const assistantMessage: ChatMessage = {
                                role: 'assistant',
                                content
                            };
                            const finalMessages = [...prev.messages, assistantMessage];
                            const atCap = finalMessages.length >= MAX_MESSAGES;

                            return {
                                ...prev,
                                messages: finalMessages,
                                currentAssistantContent: '',
                                hasPartialContent: false,
                                conversationId: event.conversationId ?? prev.conversationId,
                                status: atCap ? 'at_cap' : 'idle',
                                showPriceDisclaimer
                            };
                        }

                        if (event.type === 'error') {
                            return {
                                ...prev,
                                currentAssistantContent: '',
                                hasPartialContent: false,
                                status: 'error',
                                errorMessage: event.message
                            };
                        }

                        if (event.type === 'stream_error') {
                            return {
                                ...prev,
                                currentAssistantContent: '',
                                hasPartialContent: false,
                                status: 'error',
                                errorMessage: event.error.message
                            };
                        }

                        return prev;
                    });
                }
            }).catch(() => {
                // streamChat handles errors internally; this is a safety net
            });
        },
        [params.accommodationId, params.apiUrl, params.locale]
    );

    const abort = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    }, []);

    const reset = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setState(INITIAL_STATE);
    }, []);

    return { state, send, abort, reset };
}
