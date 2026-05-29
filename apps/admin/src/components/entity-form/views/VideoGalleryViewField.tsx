import type { VideoEntry } from '@/components/entity-form/fields/VideoGalleryField';
import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Label } from '@/components/ui-wrapped';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { ExternalLinkIcon, PlayIcon } from '@repo/icons';
import * as React from 'react';

export interface VideoGalleryViewFieldProps {
    readonly config: FieldConfig;
    readonly value?: readonly VideoEntry[];
    readonly className?: string;
    readonly showLabel?: boolean;
}

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;

function getThumbForUrl(url: string): { src: string; provider: string } | null {
    const yt = url.match(YOUTUBE_RE)?.[1];
    if (yt) return { src: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`, provider: 'YouTube' };
    const vm = url.match(VIMEO_RE)?.[1];
    if (vm) return { src: '', provider: 'Vimeo' };
    return null;
}

/**
 * VideoGalleryViewField — read-only display for `media.videos[]`.
 *
 * Mirrors the FE field shape (`VideoEntry`) but renders a static list with
 * thumbnail, provider label, URL, caption and description. No edit affordances.
 */
export const VideoGalleryViewField = React.forwardRef<HTMLDivElement, VideoGalleryViewFieldProps>(
    ({ config, value = [], className, showLabel = true }, ref) => {
        const { t } = useTranslations();
        const label = config.label;
        const fieldId = `view-field-${config.id}`;

        if (!value || value.length === 0) {
            return (
                <div
                    ref={ref}
                    id={fieldId}
                    className={cn('space-y-2', className)}
                >
                    {showLabel && label ? <Label>{label}</Label> : null}
                    <p className="text-muted-foreground text-sm italic">
                        {t('admin-entities.fields.videoGallery.emptyView', {
                            defaultValue: 'Sin videos cargados.'
                        })}
                    </p>
                </div>
            );
        }

        return (
            <div
                ref={ref}
                id={fieldId}
                className={cn('space-y-3', className)}
            >
                {showLabel && label ? <Label>{label}</Label> : null}
                <ul className="space-y-2">
                    {value.map((entry) => {
                        const meta = getThumbForUrl(entry.url);
                        const providerLabel =
                            meta?.provider ??
                            t('admin-entities.fields.videoGallery.externalProvider', {
                                defaultValue: 'Externo'
                            });
                        return (
                            <li
                                key={entry.id}
                                className="flex gap-3 rounded-md border bg-card p-3"
                            >
                                <div className="relative flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                                    {meta?.src ? (
                                        <>
                                            <img
                                                src={meta.src}
                                                alt=""
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                            <PlayIcon
                                                size={24}
                                                weight="fill"
                                                aria-hidden="true"
                                                className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 text-white drop-shadow"
                                            />
                                        </>
                                    ) : (
                                        <PlayIcon
                                            size={24}
                                            weight="regular"
                                            aria-hidden="true"
                                            className="text-muted-foreground"
                                        />
                                    )}
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <a
                                        href={entry.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 truncate text-sm hover:underline"
                                        title={entry.url}
                                    >
                                        <span className="truncate">{entry.url}</span>
                                        <ExternalLinkIcon
                                            size={12}
                                            weight="regular"
                                            aria-hidden="true"
                                            className="shrink-0"
                                        />
                                    </a>
                                    <span className="text-muted-foreground text-xs">
                                        {providerLabel}
                                    </span>
                                    {entry.caption ? (
                                        <p className="font-medium text-sm">{entry.caption}</p>
                                    ) : null}
                                    {entry.description ? (
                                        <p className="text-muted-foreground text-sm">
                                            {entry.description}
                                        </p>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }
);

VideoGalleryViewField.displayName = 'VideoGalleryViewField';
