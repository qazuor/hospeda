/**
 * HOS-390 narrowed this suite: posts and events no longer have
 * `media.featuredImage` / `media.gallery` fields at all. Their photos live in
 * the relational `post_media` / `event_media` tables and are managed from the
 * Gallery tab, so there is no create-mode exposure left to assert — the fields
 * are gone rather than merely hidden. The guard below now covers the entities
 * that still carry upload-backed fields on their form.
 */
import { describe, expect, it } from 'vitest';
import { createMediaConsolidatedSection as createDestinationMediaSection } from '@/features/destinations/config/sections/media.consolidated';
import { createBasicInfoConsolidatedSection as createEventOrganizerBasicInfoSection } from '@/features/event-organizers/config/sections/basic-info.consolidated';
import { createContactMediaConsolidatedSection } from '@/features/events/config/sections/contact-media.consolidated';
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
            findFieldModes(createDestinationMediaSection().fields, 'media.featuredImage')
        ).not.toContain('create');
        expect(findFieldModes(createSponsorBasicInfoSection().fields, 'logo')).not.toContain(
            'create'
        );
        expect(findFieldModes(createEventOrganizerBasicInfoSection().fields, 'logo')).not.toContain(
            'create'
        );
    });

    it('no longer exposes any media field on the event form (HOS-390)', () => {
        // Stronger than the create-mode check it replaced: a media field on this
        // form would write the JSONB blob, and since the read switch nothing
        // reads it — the photo would vanish rather than merely be mistimed.
        const ids = createContactMediaConsolidatedSection().fields.map((f) => f.id);

        expect(ids).not.toContain('media.featuredImage');
        expect(ids).not.toContain('media.gallery');
    });
});
