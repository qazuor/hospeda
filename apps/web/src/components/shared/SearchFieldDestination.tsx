/**
 * @file SearchFieldDestination.tsx
 * @description Reusable destination select field for the hero search form.
 * Renders a labeled dropdown populated with destination names from static data.
 * Supports desktop (transparent) and mobile (bordered) visual variants.
 */
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { DESTINATION_NAMES } from '@/data/destinations';
import { DEFAULT_LOCALE, createT } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { LocationIcon } from '@repo/icons';

/**
 * Props for the SearchFieldDestination component.
 * @property value - Currently selected destination value (empty string for none)
 * @property onValueChange - Callback fired when the user selects a destination
 * @property variant - Visual layout variant: "desktop" uses transparent bg, "mobile" uses muted bg
 * @property locale - Current locale for label and placeholder translations
 */
interface SearchFieldDestinationProps {
    /** Currently selected destination value */
    readonly value: string;
    /** Callback when destination changes */
    readonly onValueChange: (value: string) => void;
    /** Visual variant: "desktop" uses transparent bg, "mobile" uses muted bg */
    readonly variant: 'desktop' | 'mobile';
    /** Locale for translations */
    readonly locale?: SupportedLocale;
}

/**
 * Reusable destination select field for the hero search form.
 * Populates options from the DESTINATION_NAMES static data array.
 *
 * @param props - SearchFieldDestination props
 * @returns JSX element with a labeled Select dropdown
 */
export function SearchFieldDestination({
    value,
    onValueChange,
    variant,
    locale = DEFAULT_LOCALE
}: SearchFieldDestinationProps) {
    const t = createT(locale);
    const triggerClassName =
        variant === 'desktop'
            ? 'h-9 w-full border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 text-hero-text data-[placeholder]:text-hero-text-muted [&_svg:not([class*=text-])]:text-hero-text-muted'
            : 'h-11 w-full bg-muted/50 text-foreground';

    return (
        <div className={variant === 'desktop' ? 'flex-1 px-3 py-1' : undefined}>
            <span className="mb-1.5 flex items-center gap-1.5 font-semibold text-hero-text-muted text-xs uppercase tracking-wider">
                <LocationIcon
                    size={12}
                    weight={variant === 'desktop' ? 'regular' : 'duotone'}
                    color={variant === 'desktop' ? 'currentColor' : undefined}
                />
                {t('home.searchBar.destination', 'Destino')}
            </span>
            <Select
                value={value}
                onValueChange={onValueChange}
            >
                <SelectTrigger
                    className={triggerClassName}
                    chevronColor={variant === 'desktop' ? 'currentColor' : undefined}
                >
                    <SelectValue
                        placeholder={t('home.searchBar.destinationPlaceholder', 'Elegir destino')}
                    />
                </SelectTrigger>
                <SelectContent>
                    {DESTINATION_NAMES.map((d) => (
                        <SelectItem
                            key={d}
                            value={d}
                        >
                            {d}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
