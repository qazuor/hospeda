import { Button, Input, Label, Textarea } from '@/components/ui-wrapped';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { AddIcon, DeleteIcon, PlayIcon } from '@repo/icons';
import { ModerationStatusEnum } from '@repo/schemas';
import * as React from 'react';
import type { FieldConfig } from '../types/field-config.types';

/**
 * Single video entry persisted to `media.videos[]`.
 *
 * Shape mirrors `@repo/schemas` `VideoSchema` so the PATCH body parses
 * cleanly. The frontend-only `id` is stripped by Zod and used here just
 * for React keys / DnD-safe item identity.
 */
export interface VideoEntry {
    id: string;
    url: string;
    caption?: string;
    description?: string;
    moderationState: ModerationStatusEnum;
}

export interface VideoGalleryFieldProps {
    readonly config: FieldConfig;
    readonly value?: readonly VideoEntry[];
    readonly onChange?: (value: VideoEntry[]) => void;
    readonly onBlur?: () => void;
    readonly hasError?: boolean;
    readonly errorMessage?: string;
    readonly disabled?: boolean;
    readonly required?: boolean;
    readonly className?: string;
}

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;

function extractYoutubeId(url: string): string | null {
    return url.match(YOUTUBE_RE)?.[1] ?? null;
}

function extractVimeoId(url: string): string | null {
    return url.match(VIMEO_RE)?.[1] ?? null;
}

function isLikelyVideoUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function getThumbForUrl(url: string): string | null {
    const yt = extractYoutubeId(url);
    if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
    return null;
}

function genId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `video-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * VideoGalleryField — URL-based gallery for accommodation videos.
 *
 * Mirrors the image gallery UX but skips file upload: hosts paste a YouTube
 * or Vimeo URL, optionally add caption + description, and the entry persists
 * to `media.videos[]`. The quality-score `video-gallery` signal flips to
 * "done" as soon as the first entry is added.
 *
 * Entries default to `moderationState: PENDING` so the standard moderation
 * pipeline can review them, matching the image gallery behavior.
 */
export const VideoGalleryField = React.forwardRef<HTMLInputElement, VideoGalleryFieldProps>(
    (
        {
            config,
            value = [],
            onChange,
            onBlur,
            hasError = false,
            errorMessage,
            disabled = false,
            required = false,
            className
        },
        _ref
    ) => {
        const { t } = useTranslations();
        const [draftUrl, setDraftUrl] = React.useState('');
        const [draftError, setDraftError] = React.useState<string | null>(null);

        const label = config.label;
        const description = config.description;
        const helper = config.help;
        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        const items = value;

        const handleAddVideo = () => {
            const url = draftUrl.trim();
            if (!url) return;

            if (!isLikelyVideoUrl(url)) {
                setDraftError(
                    t('admin-entities.fields.videoGallery.invalidUrl', {
                        defaultValue: 'Pegá una URL completa (http o https).'
                    })
                );
                return;
            }

            if (items.some((entry) => entry.url === url)) {
                setDraftError(
                    t('admin-entities.fields.videoGallery.duplicateUrl', {
                        defaultValue: 'Ese video ya está en la galería.'
                    })
                );
                return;
            }

            const next: VideoEntry = {
                id: genId(),
                url,
                moderationState: ModerationStatusEnum.PENDING
            };
            onChange?.([...items, next]);
            setDraftUrl('');
            setDraftError(null);
        };

        const handleRemove = (id: string) => {
            onChange?.(items.filter((entry) => entry.id !== id));
        };

        const handleCaptionChange = (id: string, caption: string) => {
            onChange?.(
                items.map((entry) =>
                    entry.id === id ? { ...entry, caption: caption || undefined } : entry
                )
            );
        };

        const handleDescriptionChange = (id: string, descriptionValue: string) => {
            onChange?.(
                items.map((entry) =>
                    entry.id === id
                        ? { ...entry, description: descriptionValue || undefined }
                        : entry
                )
            );
        };

        const handleDraftKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddVideo();
            }
        };

        return (
            <div
                className={cn('space-y-3', className)}
                aria-describedby={
                    [descriptionId, helperId, errorId].filter(Boolean).join(' ') || undefined
                }
            >
                {label ? (
                    <Label htmlFor={fieldId}>
                        {label}
                        {required ? (
                            <span
                                className="ml-1 text-destructive"
                                aria-hidden="true"
                            >
                                *
                            </span>
                        ) : null}
                    </Label>
                ) : null}

                {description ? (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-sm"
                    >
                        {description}
                    </p>
                ) : null}

                {/* Add new video row */}
                <div className="flex flex-wrap items-stretch gap-2">
                    <Input
                        ref={_ref}
                        id={fieldId}
                        type="url"
                        inputMode="url"
                        placeholder={t('admin-entities.fields.videoGallery.urlPlaceholder', {
                            defaultValue: 'https://www.youtube.com/watch?v=...'
                        })}
                        value={draftUrl}
                        onChange={(e) => {
                            setDraftUrl(e.target.value);
                            if (draftError) setDraftError(null);
                        }}
                        onKeyDown={handleDraftKeyDown}
                        onBlur={onBlur}
                        disabled={disabled}
                        aria-invalid={Boolean(draftError) || hasError}
                        className="min-w-[16rem] flex-1"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddVideo}
                        disabled={disabled || draftUrl.trim().length === 0}
                    >
                        <AddIcon
                            size={16}
                            weight="regular"
                            aria-hidden="true"
                        />
                        <span className="ml-1">
                            {t('admin-entities.fields.videoGallery.add', {
                                defaultValue: 'Agregar video'
                            })}
                        </span>
                    </Button>
                </div>

                {draftError ? (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        {draftError}
                    </p>
                ) : null}

                {/* List of videos */}
                {items.length === 0 ? (
                    <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-muted-foreground text-sm">
                        {t('admin-entities.fields.videoGallery.empty', {
                            defaultValue:
                                'Todavía no hay videos. Pegá una URL de YouTube o Vimeo para agregar.'
                        })}
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {items.map((entry) => {
                            const thumb = getThumbForUrl(entry.url);
                            const provider = extractYoutubeId(entry.url)
                                ? 'YouTube'
                                : extractVimeoId(entry.url)
                                  ? 'Vimeo'
                                  : t('admin-entities.fields.videoGallery.externalProvider', {
                                        defaultValue: 'Externo'
                                    });

                            return (
                                <li
                                    key={entry.id}
                                    className="flex gap-3 rounded-md border bg-card p-3"
                                >
                                    {/* Thumbnail */}
                                    <div className="relative flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                                        {thumb ? (
                                            <>
                                                <img
                                                    src={thumb}
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

                                    {/* Fields */}
                                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <a
                                                    href={entry.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block truncate text-sm hover:underline"
                                                    title={entry.url}
                                                >
                                                    {entry.url}
                                                </a>
                                                <span className="text-muted-foreground text-xs">
                                                    {provider}
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemove(entry.id)}
                                                disabled={disabled}
                                                aria-label={t(
                                                    'admin-entities.fields.videoGallery.remove',
                                                    { defaultValue: 'Quitar video' }
                                                )}
                                            >
                                                <DeleteIcon
                                                    size={16}
                                                    weight="regular"
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                        </div>
                                        <Input
                                            type="text"
                                            placeholder={t(
                                                'admin-entities.fields.videoGallery.captionPlaceholder',
                                                {
                                                    defaultValue:
                                                        'Título corto del video (opcional)'
                                                }
                                            )}
                                            value={entry.caption ?? ''}
                                            onChange={(e) =>
                                                handleCaptionChange(entry.id, e.target.value)
                                            }
                                            disabled={disabled}
                                            maxLength={100}
                                        />
                                        <Textarea
                                            placeholder={t(
                                                'admin-entities.fields.videoGallery.descriptionPlaceholder',
                                                {
                                                    defaultValue:
                                                        'Descripción del contenido del video (opcional)'
                                                }
                                            )}
                                            value={entry.description ?? ''}
                                            onChange={(e) =>
                                                handleDescriptionChange(entry.id, e.target.value)
                                            }
                                            disabled={disabled}
                                            maxLength={300}
                                            rows={2}
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {helper ? (
                    <p
                        id={helperId}
                        className="text-muted-foreground text-xs"
                    >
                        {helper}
                    </p>
                ) : null}

                {hasError && errorMessage ? (
                    <p
                        id={errorId}
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        {errorMessage}
                    </p>
                ) : null}
            </div>
        );
    }
);

VideoGalleryField.displayName = 'VideoGalleryField';
