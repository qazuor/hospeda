/** Composition-root coverage for both production and preview render paths. */

import { renderNewsletterEmail } from '@repo/notifications';
import type { NewsletterDeliveryService } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const wiring = vi.hoisted(() => ({
    delivery: vi.fn(),
    campaign: vi.fn(),
    source: vi.fn(),
    subscriber: {}
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    NewsletterDeliveryService: class {
        constructor(...args: unknown[]) {
            wiring.delivery(...args);
        }
    },
    NewsletterCampaignService: class {
        constructor(...args: unknown[]) {
            wiring.campaign(...args);
        }
    },
    DrizzleDynamicSource: class {
        constructor(input: unknown) {
            wiring.source(input);
        }
    }
}));
vi.mock('bullmq', () => ({ Queue: class {} }));
vi.mock('ioredis', () => ({
    default: class {
        on() {}
    }
}));
vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_EMAIL_API_KEY: 'unit-test-placeholder',
        HOSPEDA_REDIS_URL: 'redis://localhost:6379',
        HOSPEDA_SITE_URL: 'https://newsletter.example.com',
        HOSPEDA_API_URL: 'https://api.example.com'
    }
}));
vi.mock('../../../src/utils/email-sender', () => ({
    getEmailSender: () => ({ fromEmail: 'test@example.com', fromName: 'Test' })
}));
vi.mock('../../../src/routes/newsletter/protected/_singletons', () => ({
    getDefaultNewsletterService: () => wiring.subscriber
}));

import {
    _resetCampaignRouteSingletons,
    getDefaultCampaignService
} from '../../../src/routes/newsletter/admin/_singletons';
import {
    _resetNewsletterDeliveryFactory,
    getNewsletterDeliveryService
} from '../../../src/services/newsletter/delivery-factory';

beforeEach(() => {
    vi.clearAllMocks();
    _resetNewsletterDeliveryFactory();
    _resetCampaignRouteSingletons();
});

describe('newsletter dynamic composition', () => {
    it('injects the segment renderer and forwards segments to the React element builder', () => {
        getNewsletterDeliveryService();
        expect(wiring.delivery).toHaveBeenCalledOnce();
        const options = wiring.delivery.mock.calls[0]?.[1] as ConstructorParameters<
            typeof NewsletterDeliveryService
        >[1];
        expect(options?.renderNewsletterEmailFn).toBe(renderNewsletterEmail);
        expect(options?.siteUrl).toBe('https://newsletter.example.com');
        const segments = ['<p>Dynamic card</p>'];
        const element = options?.buildCampaignReactElementFn?.({
            subject: 'Subject',
            bodyHtml: 'Fallback',
            segments,
            unsubscribeUrl: 'https://example.com/unsubscribe',
            isTest: true
        });
        expect(element).toBeDefined();
        // NewsletterCampaign creates its wrapper immediately: serialized children
        // must include the segments and must exclude the fallback body.
        expect(JSON.stringify(element)).toContain('Dynamic card');
        expect(JSON.stringify(element)).not.toContain('Fallback');
    });
    it('injects the source with the same site URL into the admin campaign service', async () => {
        await getDefaultCampaignService();
        expect(wiring.source.mock.calls).toEqual([[{ siteUrl: 'https://newsletter.example.com' }]]);
        expect(wiring.campaign.mock.calls[0]?.[1]).toMatchObject({
            dynamicSourcePort: expect.any(Object),
            subscriberService: wiring.subscriber
        });
    });
});
