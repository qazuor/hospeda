import { PublicationStatusEnum } from '@repo/schemas';
import { pgEnum } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../../utils/enum-utils.ts';

/**
 * PostgreSQL enum for the publication status of a listing (HOS-1478, V6.8a;
 * the `listing` state of `V/03` §9). Values: DRAFT, PUBLISHED,
 * UNPUBLISHED_BY_BILLING, ARCHIVED, MODERATED, PURGED.
 *
 * Lives here, next to `fix_request`, rather than in `enums.dbschema.ts`, which is
 * already past the 500-line limit. The tuple mirrors {@link PublicationStatusEnum}.
 */
export const PublicationStatusPgEnum = pgEnum(
    'publication_status_enum',
    enumToTuple(PublicationStatusEnum)
);
