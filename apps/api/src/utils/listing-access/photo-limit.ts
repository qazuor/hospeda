import { accommodationMediaModel } from '@repo/db';

/** Return the next visible gallery count, excluding the featured image. */
export async function accommodationGalleryPhotoLimit({
    listingId
}: {
    readonly listingId: string;
}): Promise<{ readonly key: 'max_photos_per_accommodation'; readonly requested: number }> {
    const { total } = await accommodationMediaModel.findByAccommodation({
        accommodationId: listingId,
        state: 'visible',
        isFeatured: false
    });
    return { key: 'max_photos_per_accommodation', requested: total + 1 };
}
