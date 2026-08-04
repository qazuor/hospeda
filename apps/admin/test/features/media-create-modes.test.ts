import { describe, expect, it } from 'vitest';
import { createMediaConsolidatedSection as createDestinationMediaSection } from '@/features/destinations/config/sections/media.consolidated';
import { createBasicInfoConsolidatedSection as createEventOrganizerBasicInfoSection } from '@/features/event-organizers/config/sections/basic-info.consolidated';
import { createContactMediaConsolidatedSection } from '@/features/events/config/sections/contact-media.consolidated';
import { createMediaConsolidatedSection as createPostMediaSection } from '@/features/posts/config/sections/media.consolidated';
import { createBasicInfoConsolidatedSection as createSponsorBasicInfoSection } from '@/features/sponsors/config/sections/basic-info.consolidated';

function findFieldModes(
    sectionFields: ReadonlyArray<{ id: string; modes?: readonly string[] }>,
    id: string
) {
    const field = sectionFields.find((item) => item.id === id);
    if (!field) {
        throw new Error(`Missing field ${id}`);
    }
    return field.modes ?? [];
}

describe('Admin media fields with no entityId in create mode', () => {
    it('exclude upload-backed image fields from create mode across affected entities', () => {
        expect(
            findFieldModes(createContactMediaConsolidatedSection().fields, 'media.featuredImage')
        ).not.toContain('create');
        expect(
            findFieldModes(createPostMediaSection().fields, 'media.featuredImage')
        ).not.toContain('create');
        expect(
            findFieldModes(createDestinationMediaSection().fields, 'media.featuredImage')
        ).not.toContain('create');
        expect(findFieldModes(createSponsorBasicInfoSection().fields, 'logo')).not.toContain(
            'create'
        );
        expect(findFieldModes(createEventOrganizerBasicInfoSection().fields, 'logo')).not.toContain(
            'create'
        );
    });
});
