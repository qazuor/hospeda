import { z } from 'zod';

/**
 * The closed list of listing parts support can edit through administrative
 * action 15 (ACC:15, HOS-1493, H9). The owner is told WHICH parts changed —
 * never the values — in the support-edit email and in the row-26 notice.
 */
export const SupportEditPartSchema = z.enum(['texts', 'photos', 'faq', 'hours', 'other']);

/** One part of a listing edited by support (H9). */
export type SupportEditPart = z.infer<typeof SupportEditPartSchema>;

/** One support edit of a listing as the owner sees it: when, and which parts. */
export const ListingSupportEditSchema = z.object({
    /** ISO-8601 instant of the edit. */
    occurredAt: z.string(),
    /** The parts the edit touched, without duplicates. */
    parts: z.array(SupportEditPartSchema)
});

/** One support edit of a listing (row 26). */
export type ListingSupportEdit = z.infer<typeof ListingSupportEditSchema>;

/**
 * Response of `GET /protected/{vertical}/{id}/support-edits` (row 26, H13): the
 * most recent support edits of the owner's listing. It carries neither the
 * admin's identity nor the reason — those belong to the audit register, not to
 * the owner's notice.
 */
export const ListingSupportEditsResponseSchema = z.object({
    items: z.array(ListingSupportEditSchema)
});

/** Response of the row-26 read. */
export type ListingSupportEditsResponse = z.infer<typeof ListingSupportEditsResponseSchema>;
