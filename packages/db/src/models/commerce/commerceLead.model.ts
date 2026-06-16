import { BaseModelImpl } from '../../base/base.model.ts';
import { commerceLeads } from '../../schemas/commerce/commerce_lead.dbschema.ts';

/**
 * CommerceLeadModel — DB access for inbound commerce listing leads (SPEC-239 T-023).
 *
 * Provides standard CRUD via BaseModelImpl. Custom query methods (e.g.
 * findByStatus, findByEmail) should be added here as the admin UI is built.
 */
export class CommerceLeadModel extends BaseModelImpl<typeof commerceLeads.$inferSelect> {
    protected table = commerceLeads;
    public entityName = 'commerceLeads';

    protected getTableName(): string {
        return 'commerceLeads';
    }
}

/** Singleton instance of CommerceLeadModel. */
export const commerceLeadModel = new CommerceLeadModel();
