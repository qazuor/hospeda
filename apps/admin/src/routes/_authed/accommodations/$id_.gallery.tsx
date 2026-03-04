/**
 * Accommodation Gallery Tab Route
 *
 * Displays the image gallery for a specific accommodation.
 */

import { PageTabs, accommodationTabs } from '@/components/layout/PageTabs';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/accommodations/$id_/gallery')({
    component: AccommodationGalleryPage
});

function AccommodationGalleryPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: accommodation, isLoading } = useAccommodationQuery(id);

    const featuredImage = accommodation?.media?.featuredImage;
    const galleryImages = accommodation?.media?.gallery || [];

    return (
        <div className="space-y-4">
            <PageTabs
                tabs={accommodationTabs}
                basePath={`/accommodations/${id}`}
            />

            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.gallery')}</h2>

                {isLoading ? (
                    <div className="space-y-6">
                        <div className="aspect-video w-full animate-pulse rounded-lg bg-muted" />
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                                    key={i}
                                    className="aspect-video animate-pulse rounded-lg bg-muted"
                                />
                            ))}
                        </div>
                    </div>
                ) : !featuredImage && galleryImages.length === 0 ? (
                    <p className="text-muted-foreground">
                        {t('admin-pages.accommodations.gallery.noImages')}
                    </p>
                ) : (
                    <div className="space-y-6">
                        {/* Featured Image */}
                        {featuredImage && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm">
                                    {t('admin-pages.accommodations.gallery.featuredImage')}
                                </h3>
                                <div className="group relative overflow-hidden rounded-lg border">
                                    <img
                                        src={featuredImage.url}
                                        alt={
                                            featuredImage.caption ||
                                            t('admin-pages.accommodations.gallery.featuredImageAlt')
                                        }
                                        className="aspect-video w-full object-cover"
                                    />
                                    {(featuredImage.caption || featuredImage.description) && (
                                        <div className="space-y-1 p-3">
                                            {featuredImage.caption && (
                                                <p className="font-medium text-sm">
                                                    {featuredImage.caption}
                                                </p>
                                            )}
                                            {featuredImage.description && (
                                                <p className="text-muted-foreground text-xs">
                                                    {featuredImage.description}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Gallery Images */}
                        {galleryImages.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm">
                                    {t('admin-pages.accommodations.gallery.title')} (
                                    {t(
                                        galleryImages.length === 1
                                            ? 'admin-common.gallery.imageCount_one'
                                            : 'admin-common.gallery.imageCount_other',
                                        { count: galleryImages.length }
                                    )}
                                    )
                                </h3>
                                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                                    {galleryImages.map((image, index) => (
                                        <div
                                            // biome-ignore lint/suspicious/noArrayIndexKey: gallery images may not have stable IDs
                                            key={index}
                                            className="group relative overflow-hidden rounded-lg border"
                                        >
                                            <img
                                                src={image.url}
                                                alt={
                                                    image.caption ||
                                                    t(
                                                        'admin-pages.accommodations.gallery.imageAlt',
                                                        { index: String(index + 1) }
                                                    )
                                                }
                                                className="aspect-video w-full object-cover"
                                            />
                                            {(image.caption || image.description) && (
                                                <div className="space-y-1 p-2">
                                                    {image.caption && (
                                                        <p className="font-medium text-xs">
                                                            {image.caption}
                                                        </p>
                                                    )}
                                                    {image.description && (
                                                        <p className="text-[10px] text-muted-foreground leading-tight">
                                                            {image.description}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
