import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCapture } = vi.hoisted(() => ({ mockCapture: vi.fn() }));

vi.mock('../../../../src/lib/analytics-client.js', () => ({
    captureServerAnalyticsEvent: mockCapture
}));

import { captureChatEvent } from '../../../../src/routes/ai/protected/chat.helpers';

describe('captureChatEvent — ai_chat_response_completed', () => {
    beforeEach(() => {
        mockCapture.mockClear();
    });

    it('maps an empty provider and model to null so the catalog does not reject the event', () => {
        captureChatEvent('actor-1', 'ai_chat_response_completed', {
            entityId: '11111111-1111-4111-8111-111111111111',
            locale: 'es',
            provider: '',
            model: ''
        });

        expect(mockCapture).toHaveBeenCalledTimes(1);
        expect(mockCapture.mock.calls[0]?.[0].properties).toMatchObject({
            provider: null,
            model: null
        });
    });
});

describe('captureChatEvent — visitor (HOS-2119 T-072)', () => {
    const visitor = { ip: '203.0.113.7', userAgent: 'UA/1' };
    const props = { entityId: '11111111-1111-4111-8111-111111111111', locale: 'es' } as const;
    const events = [
        'ai_chat_opened',
        'ai_chat_cap_reached',
        'ai_chat_message_sent',
        'ai_chat_moderation_blocked',
        'ai_chat_response_completed'
    ] as const;

    beforeEach(() => {
        mockCapture.mockClear();
    });

    it.each(events)('should pass the visitor for %s', (event) => {
        captureChatEvent('actor-1', event, props, { visitor });

        expect(mockCapture).toHaveBeenCalledTimes(1);
        expect(mockCapture.mock.calls[0]?.[0].visitor).toEqual(visitor);
    });

    it.each(events)('should omit visitor for %s when none is given', (event) => {
        captureChatEvent('actor-1', event, props);
        captureChatEvent('actor-1', event, props, { visitor: undefined });

        expect(mockCapture).toHaveBeenCalledTimes(2);
        for (const call of mockCapture.mock.calls) {
            expect(call[0]).not.toHaveProperty('visitor');
        }
    });
});
