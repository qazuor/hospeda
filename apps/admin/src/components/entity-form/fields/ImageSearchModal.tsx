import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';

import { Input } from '@/components/ui-wrapped';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { AlertTriangleIcon, CloseIcon, ImageIcon, SearchIcon } from '@repo/icons';
import * as React from 'react';

export interface StockImageResult {
    providerId: string;
    provider: 'unsplash' | 'pexels';
    thumbUrl: string;
    fullUrl: string;
    width: number;
    height: number;
    photographer: string;
    photographerUrl: string;
    downloadLocation?: string;
}

export interface ImageSearchModalProps {
    /** Whether the dialog is open */
    open?: boolean;
    /** Open change handler */
    onOpenChange?: (open: boolean) => void;
    /** Trigger element (button) */
    trigger?: React.ReactNode;
    /** Callback when an image is selected and imported */
    onImageImported: (result: {
        url: string;
        publicId: string;
        width: number;
        height: number;
        attribution: {
            photographer: string;
            sourceUrl: string;
            license: string;
            provider: 'unsplash' | 'pexels';
        };
        moderationState: 'APPROVED';
    }) => void;
    /** Entity type for import */
    entityType: 'accommodation' | 'destination' | 'event' | 'post';
    /** Entity UUID */
    entityId: string;
    /** Role: featured or gallery */
    targetRole: 'featured' | 'gallery';
}

interface SearchState {
    query: string;
    provider: 'unsplash' | 'pexels';
    orientation: 'landscape' | 'portrait' | 'squarish' | 'all';
    page: number;
}

const PER_PAGE = 24;

/**
 * ImageSearchModal component for searching and importing stock images from Unsplash/Pexels.
 *
 * Features:
 * - Tab-based provider selection (Unsplash | Pexels)
 * - Orientation filter (landscape | portrait | squarish)
 * - Grid of thumbnails with photographer attribution
 * - Preview modal on selection
 * - Server-side import with attribution persistence
 *
 * Accessibility:
 * - Full keyboard navigation
 * - Screen reader announcements for loading/error states
 * - Focus management via Dialog component
 */
export const ImageSearchModal: React.FC<ImageSearchModalProps> = ({
    open,
    onOpenChange,
    trigger,
    onImageImported,
    entityType,
    entityId,
    targetRole
}) => {
    const { t } = useTranslations();
    const [isOpen, setIsOpen] = React.useState(open ?? false);

    const [searchState, setSearchState] = React.useState<SearchState>({
        query: '',
        provider: 'unsplash',
        orientation: 'all',
        page: 1
    });

    const [results, setResults] = React.useState<StockImageResult[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isImporting, setIsImporting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [selectedImage, setSelectedImage] = React.useState<StockImageResult | null>(null);
    const [hasSearched, setHasSearched] = React.useState(false);

    const selectedImageRef = React.useRef<StockImageResult | null>(null);

    React.useEffect(() => {
        if (selectedImage) {
            selectedImageRef.current = selectedImage;
        }
    }, [selectedImage]);

    React.useEffect(() => {
        if (onOpenChange) {
            onOpenChange(isOpen);
        }
    }, [isOpen, onOpenChange]);

    React.useEffect(() => {
        if (open !== undefined) {
            setIsOpen(open);
        }
    }, [open]);

    const performSearch = React.useCallback(async () => {
        if (!searchState.query.trim()) {
            setResults([]);
            setHasSearched(true);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const searchParams = new URLSearchParams({
                provider: searchState.provider,
                query: searchState.query,
                page: searchState.page.toString(),
                perPage: PER_PAGE.toString()
            });

            if (searchState.orientation !== 'all') {
                searchParams.append('orientation', searchState.orientation);
            }

            const response = await fetchApi({
                path: `/api/v1/admin/media/search?${searchParams.toString()}`
            });

            const data = response.data as { results?: StockImageResult[] };
            setResults(data.results ?? []);
            setHasSearched(true);
        } catch (err) {
            adminLogger.error('[ImageSearchModal] Search failed', err);
            if (err instanceof ApiError) {
                if (err.status === 503) {
                    setError(t('admin-entities.fields.image.stock.providersNotConfigured'));
                } else if (err.status === 429) {
                    setError(
                        searchState.provider === 'unsplash'
                            ? t('admin-entities.fields.image.stock.unsplashRateLimit')
                            : t('admin-entities.fields.image.stock.pexelsRateLimit')
                    );
                } else {
                    setError(t('admin-entities.fields.image.stock.searchError'));
                }
            } else {
                setError(t('admin-entities.fields.image.stock.searchError'));
            }
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchState.provider, searchState.query, searchState.orientation, searchState.page, t]);

    const debouncedSearch = React.useMemo(() => {
        const timeout = setTimeout(() => {
            if (searchState.query.trim()) {
                performSearch();
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [performSearch, searchState.query]);

    React.useEffect(() => {
        debouncedSearch();
    }, [debouncedSearch]);

    const handleImport = async () => {
        if (!selectedImageRef.current) return;

        setIsImporting(true);
        setError(null);

        try {
            const response = await fetchApi({
                path: '/api/v1/admin/media/import-stock',
                method: 'POST',
                body: {
                    provider: selectedImageRef.current.provider,
                    providerId: selectedImageRef.current.providerId,
                    fullUrl: selectedImageRef.current.fullUrl,
                    downloadLocation: selectedImageRef.current.downloadLocation,
                    photographer: selectedImageRef.current.photographer,
                    photographerUrl: selectedImageRef.current.photographerUrl,
                    entityType,
                    entityId,
                    targetRole
                }
            });

            const data = response.data as {
                url: string;
                publicId: string;
                width: number;
                height: number;
                attribution: {
                    photographer: string;
                    sourceUrl: string;
                    license: string;
                    provider: 'unsplash' | 'pexels';
                };
                moderationState: 'APPROVED';
            };
            onImageImported(data);
            setIsOpen(false);
            setSelectedImage(null);
            selectedImageRef.current = null;
        } catch (err) {
            adminLogger.error('[ImageSearchModal] Import failed', err);
            if (err instanceof ApiError) {
                if (err.status === 422) {
                    const limit = (err.body as { error?: { details?: { limit?: number } } })?.error
                        ?.details?.limit;
                    setError(
                        t('admin-entities.fields.image.stock.galleryLimitExceeded', {
                            limit: limit?.toString() ?? '?'
                        })
                    );
                } else if (err.status === 404) {
                    setError(t('admin-entities.fields.image.stock.entityNotFound'));
                } else {
                    setError(t('admin-entities.fields.image.stock.importError'));
                }
            } else {
                setError(t('admin-entities.fields.image.stock.importError'));
            }
        } finally {
            setIsImporting(false);
        }
    };

    const handleProviderChange = (provider: 'unsplash' | 'pexels') => {
        setSearchState((prev) => ({ ...prev, provider, page: 1 }));
        setResults([]);
        setHasSearched(false);
    };

    const handleOrientationChange = (
        orientation: 'landscape' | 'portrait' | 'squarish' | 'all'
    ) => {
        setSearchState((prev) => ({ ...prev, orientation, page: 1 }));
    };

    const handleLoadMore = () => {
        setSearchState((prev) => ({ ...prev, page: prev.page + 1 }));
    };

    const handleReset = () => {
        setSearchState({
            query: '',
            provider: 'unsplash',
            orientation: 'all',
            page: 1
        });
        setResults([]);
        setHasSearched(false);
        setError(null);
        setSelectedImage(null);
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent
                className={cn(
                    'max-w-[96vw] sm:max-w-[1200px]',
                    'max-h-[90vh] overflow-hidden',
                    'flex flex-col'
                )}
            >
                <DialogHeader>
                    <DialogTitle>{t('admin-entities.fields.image.stock.modalTitle')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('admin-entities.fields.image.stock.modalDescription')}
                    </DialogDescription>
                </DialogHeader>

                {/* Search controls */}
                <div className="flex flex-col gap-4 border-b pb-4">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={searchState.query}
                                onChange={(e) =>
                                    setSearchState((prev) => ({ ...prev, query: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        performSearch();
                                    }
                                }}
                                placeholder={t(
                                    'admin-entities.fields.image.stock.searchPlaceholder'
                                )}
                                className="pl-9"
                                disabled={isLoading}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                            disabled={!searchState.query && !hasSearched}
                        >
                            <CloseIcon className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Provider tabs */}
                        <div className="flex rounded-md border p-1">
                            <button
                                type="button"
                                onClick={() => handleProviderChange('unsplash')}
                                className={cn(
                                    'rounded px-3 py-1 font-medium text-sm transition-colors',
                                    searchState.provider === 'unsplash'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-accent'
                                )}
                            >
                                Unsplash
                            </button>
                            <button
                                type="button"
                                onClick={() => handleProviderChange('pexels')}
                                className={cn(
                                    'rounded px-3 py-1 font-medium text-sm transition-colors',
                                    searchState.provider === 'pexels'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-accent'
                                )}
                            >
                                Pexels
                            </button>
                        </div>

                        {/* Orientation filter */}
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-sm">
                                {t('admin-entities.fields.image.stock.orientation')}:
                            </span>
                            {(['all', 'landscape', 'portrait', 'squarish'] as const).map(
                                (orientation) => (
                                    <button
                                        key={orientation}
                                        type="button"
                                        onClick={() => handleOrientationChange(orientation)}
                                        className={cn(
                                            'rounded px-2 py-1 font-medium text-xs transition-colors',
                                            searchState.orientation === orientation
                                                ? 'bg-accent text-accent-foreground'
                                                : 'text-muted-foreground hover:bg-accent'
                                        )}
                                    >
                                        {t(
                                            `admin-entities.fields.image.stock.orientation.${orientation}`
                                        )}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Error banner */}
                {error && (
                    <div
                        role="alert"
                        aria-live="assertive"
                        className="flex items-start gap-2 rounded-md border-destructive bg-destructive/10 p-3 text-destructive"
                    >
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 text-sm">{error}</div>
                        <button
                            type="button"
                            onClick={() => setError(null)}
                            className="rounded p-1 hover:bg-destructive/20"
                            aria-label={t('common.cancel')}
                        >
                            <CloseIcon className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Results grid */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading && results.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                <p>{t('admin-entities.fields.image.stock.searching')}</p>
                            </div>
                        </div>
                    ) : hasSearched ? (
                        results.length === 0 ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <SearchIcon className="h-12 w-12 opacity-50" />
                                    <p>
                                        {t('admin-entities.fields.image.stock.noResults', {
                                            query: searchState.query
                                        })}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                                {results.map((image) => (
                                    <button
                                        key={`${image.provider}-${image.providerId}`}
                                        type="button"
                                        onClick={() => setSelectedImage(image)}
                                        className={cn(
                                            'group relative aspect-square overflow-hidden rounded-md bg-accent transition-shadow hover:shadow-md',
                                            selectedImage?.providerId === image.providerId &&
                                                'ring-2 ring-primary'
                                        )}
                                    >
                                        <img
                                            src={image.thumbUrl}
                                            alt={image.photographer}
                                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                            <p className="truncate text-white text-xs">
                                                {image.photographer}
                                            </p>
                                            <p className="text-[10px] text-white/80">
                                                {image.provider === 'unsplash'
                                                    ? 'Unsplash'
                                                    : 'Pexels'}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )
                    ) : (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <ImageIcon className="h-12 w-12 opacity-50" />
                                <p>{t('admin-entities.fields.image.stock.searchPrompt')}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer with pagination and import */}
                <DialogFooter className="flex items-center justify-between border-t pt-4">
                    <div className="text-muted-foreground text-sm">
                        {results.length > 0 && (
                            <span>
                                {t('admin-entities.fields.image.stock.resultsCount', {
                                    count: results.length
                                })}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {results.length >= PER_PAGE && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleLoadMore}
                                disabled={isLoading}
                            >
                                {t('admin-entities.fields.image.stock.loadMore')}
                            </Button>
                        )}
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleImport}
                            disabled={!selectedImage || isImporting}
                        >
                            {isImporting
                                ? t('admin-entities.fields.image.stock.importing')
                                : t('admin-entities.fields.image.stock.importButton')}
                        </Button>
                    </div>
                </DialogFooter>

                {/* Preview dialog */}
                {selectedImage && (
                    <Dialog
                        open={!!selectedImage}
                        onOpenChange={(open) => {
                            if (!open) {
                                setSelectedImage(null);
                            }
                        }}
                    >
                        <DialogContent className="max-w-[min(96vw,1200px)] border-0 bg-transparent p-0 shadow-none">
                            <DialogTitle className="sr-only">
                                {t('admin-entities.fields.image.stock.previewTitle', {
                                    photographer: selectedImage.photographer
                                })}
                            </DialogTitle>
                            <div className="flex flex-col">
                                <img
                                    src={selectedImage.fullUrl}
                                    alt={selectedImage.photographer}
                                    className="max-h-[70vh] w-full rounded-md object-contain"
                                />
                                <div className="mt-4 flex items-center justify-between">
                                    <div className="text-sm">
                                        <p className="font-medium">
                                            {t('admin-entities.fields.image.stock.previewByline', {
                                                photographer: selectedImage.photographer
                                            })}
                                        </p>
                                        <p className="text-muted-foreground">
                                            {selectedImage.provider === 'unsplash'
                                                ? 'Unsplash'
                                                : 'Pexels'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setSelectedImage(null)}
                                        >
                                            {t('common.cancel')}
                                        </Button>
                                        <Button
                                            variant="default"
                                            onClick={handleImport}
                                            disabled={isImporting}
                                        >
                                            {isImporting
                                                ? t('admin-entities.fields.image.stock.importing')
                                                : t(
                                                      'admin-entities.fields.image.stock.importButton'
                                                  )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </DialogContent>
        </Dialog>
    );
};
