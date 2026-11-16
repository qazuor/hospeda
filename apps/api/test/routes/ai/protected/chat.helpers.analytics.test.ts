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
