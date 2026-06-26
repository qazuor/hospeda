import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';

import { ImageIcon } from '@repo/icons';
import type * as React from 'react';

/**
 * StockImageSearchTrigger button component.
 *
 * A reusable trigger button for opening the ImageSearchModal.
 * Use this as the `trigger` prop for ImageSearchModal.
 *
 * Example:
 * ```tsx
 * <ImageSearchModal
 *     trigger={<StockImageSearchTrigger />}
 *     onImageImported={handleImported}
 *     entityType="event"
 *     entityId={entityId}
 *     role="featured"
 * />
 * ```
 */
export const StockImageSearchTrigger: React.FC = () => {
    const { t } = useTranslations();

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
        >
            <ImageIcon className="h-4 w-4" />
            {t('admin-entities.fields.image.stock.importButton')}
        </Button>
    );
};
