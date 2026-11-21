import { describe, expect, it } from 'vitest';
import { AnalyticsEventSchemas, AnalyticsEvents } from '../src/catalog.js';

const payload = {
    listing_id: 'listing-123',
    vertical: 'partner',
    channel: 'whatsapp',
    origin: 'gallery',
    is_whatsapp_entitled: false,
    locale: 'pt'
};

describe('listing contact analytics', () => {
    it('registers the event and accepts contact payloads with or without entitlement', () => {
        const name = AnalyticsEvents.listingContactClicked;
        const { is_whatsapp_entitled: _, ...withoutEntitlement } = payload;

        expect(name).toBe('listing_contact_clicked');
        expect(AnalyticsEventSchemas[name].parse(payload)).toEqual(payload);
        expect(AnalyticsEventSchemas[name].parse(withoutEntitlement)).toEqual(withoutEntitlement);
    });

    it.each([
        { channel: 'sms' },
        { origin: 'footer' },
        { listing_id: '' },
        { vertical: 'event' },
        { locale: 'p' },
        { is_whatsapp_entitled: 'true' }
    ])('rejects %j', (invalid) => {
        const result = AnalyticsEventSchemas[AnalyticsEvents.listingContactClicked]?.safeParse({
            ...payload,
            ...invalid
        });

        expect(result?.success).toBe(false);
    });
});
