/**
 * Shared gallery types used by GalleryField and its sub-components.
 */
export interface GalleryImage {
    id: string;
    url: string;
    caption?: string;
    description?: string;
    alt?: string;
    order: number;
}
