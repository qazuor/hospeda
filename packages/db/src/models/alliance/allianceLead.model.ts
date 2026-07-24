import { BaseModelImpl } from '../../base/base.model.ts';
import { allianceLeads } from '../../schemas/alliance/alliance_lead.dbschema.ts';

/**
 * AllianceLeadModel — DB access for inbound alliance leads (HOS-277).
 *
 * Provides standard CRUD via BaseModelImpl, including soft-delete/restore
 * (the table carries a `deletedAt` column, unlike `commerceLeads`). Custom
 * query methods (e.g. findByKind, findByStatus) should be added here as the
 * admin inbox is built.
 */
export class AllianceLeadModel extends BaseModelImpl<typeof allianceLeads.$inferSelect> {
    protected table = allianceLeads;
    public entityName = 'allianceLeads';

    protected getTableName(): string {
        return 'allianceLeads';
    }
}

/** Singleton instance of AllianceLeadModel. */
export const allianceLeadModel = new AllianceLeadModel();
