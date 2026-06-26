import type { ModerationStatusEnum } from '@repo/schemas';

/**
 * Shared gallery types used by GalleryField and its sub-components.
 *
 * The shape mirrors `ImageSchema` from `@repo/schemas` so the form's PATCH
 * body parses cleanly (Zod strips the frontend-only `id`/`alt`/`order`
 * fields). `moderationState` is required by `ImageSchema` and must always
 * be present on every gallery item — new uploads default to PENDING; items
 * loaded from the API preserve whatever the server sent.
 */
export interface GalleryImage {
    id: string;
    url: string;
    caption?: string;
    description?: string;
    alt?: string;
    order: number;
    moderationState: ModerationStatusEnum;
    attribution?: {
        photographer: string;
        sourceUrl: string;
        license: string;
        provider: 'unsplash' | 'pexels';
    };
}
