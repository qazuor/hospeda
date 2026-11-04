import { describe, expect, it } from 'vitest';
import { ExperienceService } from '../../../src/services/experience/experience.service';
import { VenueService } from '../../../src/services/venue/venue.service';

type ServiceWithContactNormalizer = {
    normalizers: {
        update: (data: unknown, actor: unknown) => unknown;
    };
};

describe('venue and experience contact normalizers', () => {
    it.each([
        ['venue', () => new VenueService({})],
        ['experience', () => new ExperienceService({})]
    ])('%s normalizes owner contact updates before persistence', (_entity, createService) => {
        const service = createService() as unknown as ServiceWithContactNormalizer;
        const result = service.normalizers.update(
            { contactInfo: { mobilePhone: '+54 9 3442 45-2345', whatsapp: '3442 45-2345' } },
            {}
        ) as { contactInfo: { mobilePhone: string; whatsapp: string } };

        expect(result.contactInfo).toEqual({
            mobilePhone: '+5493442452345',
            whatsapp: '+5493442452345'
        });
    });
});
