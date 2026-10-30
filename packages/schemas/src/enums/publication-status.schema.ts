import { z } from 'zod';
import { PublicationStatusEnum } from './publication-status.enum.js';

/** Zod schema for {@link PublicationStatusEnum} (the `listing` state of `V/03` §9). */
export const PublicationStatusEnumSchema = z.nativeEnum(PublicationStatusEnum, {
    error: () => ({ message: 'zodError.enums.publicationStatus.invalid' })
});
/** One publication status of a listing. */
export type PublicationStatusSchema = z.infer<typeof PublicationStatusEnumSchema>;
