import { GridIcon, MapIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Props for the ViewToggle component
 */
export interface ViewToggleProps {
    /**
     * Default view mode to display
     * @default 'grid'
     */
    readonly defaultView?: 'grid' | 'map';

    /**
     * Callback fired when view mode changes
     */
    readonly onChange?: (view: 'grid' | 'map') => void;

    /**
     * Additional CSS classes to apply to the component
     */
    readonly className?: string;
    /**
     * Locale for i18n translations
     * @default 'es'
     */
    readonly locale?: SupportedLocale;
}

/**
 * ViewToggle component
 *
 * A toggle button group that allows users to switch between grid and map views.
 * Implements accessible toggle button pattern with proper ARIA attributes.
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <ViewToggle
 *   defaultView="grid"
 *   onChange={(view) => console.log('View changed to:', view)}
 *   className="my-custom-class"
 * />
 * ```
 */
export function ViewToggle({
    defaultView = 'grid',
    onChange,
    className = '',
    locale = 'es'
}: ViewToggleProps): JSX.Element {
    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });
    const [activeView, setActiveView] = useState<'grid' | 'map'>(defaultView);

    const handleViewChange = (view: 'grid' | 'map') => {
        setActiveView(view);
        onChange?.(view);
    };

    const baseButtonStyles =
        'inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50';

    const getButtonStyles = (view: 'grid' | 'map') => {
        const isActive = activeView === view;
        return `${baseButtonStyles} ${
            isActive ? 'bg-primary text-white' : 'bg-transparent text-text hover:bg-surface-alt'
        }`;
    };

    return (
        <fieldset
            aria-label={t('accessibility.viewToggle')}
            className={`inline-flex rounded-lg border border-border ${className}`.trim()}
        >
            <button
                type="button"
                onClick={() => handleViewChange('grid')}
                aria-pressed={activeView === 'grid'}
                aria-label={t('accessibility.gridView')}
                className={`${getButtonStyles('grid')} rounded-l-lg border-border border-r`}
            >
                <GridIcon
                    size={20}
                    className="h-5 w-5"
                    aria-hidden="true"
                />
            </button>

            <button
                type="button"
                onClick={() => handleViewChange('map')}
                aria-pressed={activeView === 'map'}
                aria-label={t('accessibility.mapView')}
                className={`${getButtonStyles('map')} rounded-r-lg`}
            >
                <MapIcon
                    size={20}
                    className="h-5 w-5"
                    aria-hidden="true"
                />
            </button>
        </fieldset>
    );
}
