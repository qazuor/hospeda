import type { VenueEvent } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { venueEvents } from '../../schemas/venue/venue_event.dbschema.ts';

/**
 * VenueEventModel — DB access for a venue's own agenda (HOS-1042).
 *
 * Thin `BaseModelImpl` wrapper, exactly like `VenueMenuSectionModel`.
 * Ordering (`display_order ASC`) is applied by the caller, which is the same
 * convention the FAQ and menu models document.
 *
 * There is no soft delete here on purpose, for the same reason the menu has
 * none: the agenda is rewritten transactionally by `replaceVenueEvents`,
 * so a tombstoned entry would only ever be dead weight the read has to filter.
 * An owner who wants to keep a seasonal event without showing it sets
 * `isActive: false` instead — that is what that column is for, and it is a
 * different statement from "deleted".
 */
export class VenueEventModel extends BaseModelImpl<VenueEvent> {
    protected table = venueEvents;
    public entityName = 'venueEvents';

    protected getTableName(): string {
        return 'venueEvents';
    }
}

/** Singleton instance of VenueEventModel. */
export const venueEventModel = new VenueEventModel();
