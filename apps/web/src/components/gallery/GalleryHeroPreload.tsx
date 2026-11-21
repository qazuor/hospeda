interface Props {
    readonly src: string;
    readonly srcSet?: string;
    readonly sizes?: string;
    readonly media: string;
}

/** Restores the eager hero's SSR preload when its image URL lives in a picture source. */
export function GalleryHeroPreload({ src, srcSet, sizes, media }: Props) {
    return (
        <link
            rel="preload"
            as="image"
            media={media}
            href={srcSet ? undefined : src}
            imageSrcSet={srcSet}
            imageSizes={sizes}
            fetchPriority="high"
        />
    );
}
