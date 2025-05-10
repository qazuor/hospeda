import { EmailTemplateTypeEnum, StateEnum } from '@repo/types';
import { boolean, date, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/db-utils';

/**
 * Table: email_templates
 * Stores reusable email templates for transactional and marketing flows.
 */
export const emailTemplates = pgTable('email_templates', {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Template identifiers
     */
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull(),
    bodyText: text('body_text'),

    /**
     * Categorization
     */
    tags: jsonb('tags').default([]),
    type: text('type', { enum: enumToTuple(EmailTemplateTypeEnum) }).notNull(),

    /**
     * Control flags
     */
    isSystem: boolean('is_system').default(false).notNull(),

    /**
     * Ownership and metadata
     */
    owner: uuid('owner'),
    adminInfo: jsonb('admin_info'),
    state: text('state', { enum: enumToTuple(StateEnum) })
        .default(StateEnum.ACTIVE)
        .notNull(),

    /**
     * Timestamps
     */
    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});
