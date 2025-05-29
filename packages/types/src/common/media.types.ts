import type { WithModerationState, WithTags } from './helpers.types.js';

export interface ImageType extends WithModerationState, WithTags {
    url: string;
    caption?: string;
    description?: string;
}

export interface VideoType extends WithModerationState, WithTags {
    url: string;
    caption?: string;
    description?: string;
}

export interface MediaType {
    featuredImage: ImageType;
    gallery?: ImageType[];
    videos?: VideoType[];
}
