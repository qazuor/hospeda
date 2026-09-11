import type { GastronomyMenuSection } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { gastronomyMenuSections } from '../../schemas/gastronomy/gastronomy_menu_section.dbschema.ts';

/**
 * GastronomyMenuSectionModel — DB access for the course headings of a venue's
 * menu (HOS-895).
 *
 * Thin `BaseModelImpl` wrapper, exactly like `GastronomyFaqModel`. Ordering
 * (`display_order ASC`) is applied by the caller, which is the same convention
 * the FAQ model documents.
 *
 * There is no soft delete here on purpose: a removed course is removed, and the
 * whole menu is rewritten transactionally by `replaceGastronomyMenu`, so a
 * tombstoned section would only ever be dead weight the read has to filter.
 */
export class GastronomyMenuSectionModel extends BaseModelImpl<GastronomyMenuSection> {
    protected table = gastronomyMenuSections;
    public entityName = 'gastronomyMenuSections';

    protected getTableName(): string {
        return 'gastronomyMenuSections';
    }
}

/** Singleton instance of GastronomyMenuSectionModel. */
export const gastronomyMenuSectionModel = new GastronomyMenuSectionModel();
