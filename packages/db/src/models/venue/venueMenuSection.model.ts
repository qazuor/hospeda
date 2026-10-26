import type { VenueMenuSection } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { gastronomyMenuSections } from '../../schemas/venue/venue_menu_section.dbschema.ts';

/**
 * VenueMenuSectionModel — DB access for the course headings of a venue's
 * menu (HOS-895).
 *
 * Thin `BaseModelImpl` wrapper, exactly like `VenueFaqModel`. Ordering
 * (`display_order ASC`) is applied by the caller, which is the same convention
 * the FAQ model documents.
 *
 * There is no soft delete here on purpose: a removed course is removed, and the
 * whole menu is rewritten transactionally by `replaceGastronomyMenu`, so a
 * tombstoned section would only ever be dead weight the read has to filter.
 */
export class VenueMenuSectionModel extends BaseModelImpl<VenueMenuSection> {
    protected table = gastronomyMenuSections;
    public entityName = 'gastronomyMenuSections';

    protected getTableName(): string {
        return 'gastronomyMenuSections';
    }
}

/** Singleton instance of VenueMenuSectionModel. */
export const venueMenuSectionModel = new VenueMenuSectionModel();
