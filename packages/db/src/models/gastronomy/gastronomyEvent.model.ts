import type { GastronomyEvent } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { gastronomyEvents } from '../../schemas/gastronomy/gastronomy_event.dbschema.ts';

/**
 * GastronomyEventModel — DB access for a venue's own agenda (HOS-1042).
 *
 * Thin `BaseModelImpl` wrapper, exactly like `GastronomyMenuSectionModel`.
 * Ordering (`display_order ASC`) is applied by the caller, which is the same
 * convention the FAQ and menu models document.
 *
 * There is no soft delete here on purpose, for the same reason the menu has
 * none: the agenda is rewritten transactionally by `replaceGastronomyEvents`,
 * so a tombstoned entry would only ever be dead weight the read has to filter.
 * An owner who wants to keep a seasonal event without showing it sets
 * `isActive: false` instead — that is what that column is for, and it is a
 * different statement from "deleted".
 */
export class GastronomyEventModel extends BaseModelImpl<GastronomyEvent> {
    protected table = gastronomyEvents;
    public entityName = 'gastronomyEvents';

    protected getTableName(): string {
        return 'gastronomyEvents';
    }
}

/** Singleton instance of GastronomyEventModel. */
export const gastronomyEventModel = new GastronomyEventModel();
