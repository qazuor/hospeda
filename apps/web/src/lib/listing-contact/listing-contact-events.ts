import { ContactOriginSchema } from '@repo/analytics';
import { z } from 'zod';

/** Runtime vocabulary shared with listing contact analytics. */
export { ContactOriginSchema };

/** The listing surface where a contact action originated. */
export type ContactOrigin = z.infer<typeof ContactOriginSchema>;

const eventName = 'hospeda:listing-contact:open';
const payloadSchema = z.object({
    origin: ContactOriginSchema,
    focus: z.enum(['whatsapp', 'form']).optional()
});

/** Request to open the panel, optionally focusing a specific section. */
export type ListingContactPanelOpen = Readonly<z.infer<typeof payloadSchema>>;

/** Broadcasts a valid contact panel request in the browser. */
export function openListingContactPanel(payload: ListingContactPanelOpen): void {
    if (typeof window === 'undefined') return;
    const parsed = payloadSchema.safeParse(payload);
    if (parsed.success) window.dispatchEvent(new CustomEvent(eventName, { detail: parsed.data }));
}

/** Subscribes to valid panel requests and returns an unsubscribe function. */
export function onListingContactPanelOpen(
    handler: (payload: ListingContactPanelOpen) => void
): () => void {
    if (typeof window === 'undefined') return () => {};
    const target = window;
    const listener = (event: Event): void => {
        if (!(event instanceof CustomEvent)) return;
        const parsed = payloadSchema.safeParse(event.detail);
        if (parsed.success) handler(parsed.data);
    };
    target.addEventListener(eventName, listener);
    return () => target.removeEventListener(eventName, listener);
}
