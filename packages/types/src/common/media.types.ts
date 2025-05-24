import type { WithActivityState, WithTags } from './helpers.types.js';

export interface ImageType extends WithActivityState, WithTags {
    url: string;
    caption?: string;
    description?: string;
}

export interface VideoType extends WithActivityState, WithTags {
    url: string;
    caption?: string;
    description?: string;
}

export interface MediaType {
    featuredImage: ImageType;
    gallery?: ImageType[];
    videos?: VideoType[];
}
