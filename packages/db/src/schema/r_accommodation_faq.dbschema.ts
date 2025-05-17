import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema.js';
import { accommodationFaqs } from './accommodation_faq.dbschema.js';

/**
 * r_accommodation_faq join table
 * Composite PK on (accommodation_id, faq_id)
 */
export const accommodationFaqRelations: ReturnType<typeof pgTable> = pgTable(
    'r_accommodation_faq',
    {
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        faqId: uuid('faq_id')
            .notNull()
            .references(() => accommodationFaqs.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.accommodationId, table.faqId] })
    })
);
