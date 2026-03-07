/**
 * @file SearchFieldType.tsx
 * @description Reusable accommodation type select field for the hero search form.
 * Renders a labeled dropdown populated with accommodation type names from static data.
 * Supports desktop (transparent) and mobile (bordered) visual variants.
 */
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { ACCOMMODATION_TYPE_NAMES } from '@/data/accommodation-types';
import { DEFAULT_LOCALE, createT } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { HomeIcon } from '@repo/icons';

/**
 * Props for the SearchFieldType component.
 * @property value - Currently selected accommodation type value (empty string for none)
 * @property onValueChange - Callback fired when the user selects an accommodation type
 * @property variant - Visual layout variant: "desktop" uses transparent bg, "mobile" uses muted bg
 * @property locale - Current locale for label and placeholder translations
 */
interface SearchFieldTypeProps {
    /** Currently selected accommodation type value */
    readonly value: string;
    /** Callback when type changes */
    readonly onValueChange: (value: string) => void;
    /** Visual variant: "desktop" uses transparent bg, "mobile" uses muted bg */
    readonly variant: 'desktop' | 'mobile';
    /** Locale for translations */
    readonly locale?: SupportedLocale;
}

/**
 * Reusable accommodation type select field for the hero search form.
 * Populates options from the ACCOMMODATION_TYPE_NAMES static data array.
 *
 * @param props - SearchFieldType props
 * @returns JSX element with a labeled Select dropdown
 */
export function SearchFieldType({
    value,
    onValueChange,
    variant,
    locale = DEFAULT_LOCALE
}: SearchFieldTypeProps) {
    const t = createT(locale);
    const triggerClassName =
        variant === 'desktop'
            ? 'h-9 w-full border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 text-hero-text data-[placeholder]:text-hero-text-muted [&_svg:not([class*=text-])]:text-hero-text-muted'
            : 'h-11 w-full bg-muted/50 text-foreground';

    return (
        <div className={variant === 'desktop' ? 'flex-1 px-3 py-1' : undefined}>
            <span className="mb-1.5 flex items-center gap-1.5 font-semibold text-hero-text-muted text-xs uppercase tracking-wider">
                <HomeIcon
                    size={12}
                    weight={variant === 'desktop' ? 'regular' : 'duotone'}
                    color={variant === 'desktop' ? 'currentColor' : undefined}
                />
                {t('home.searchBar.accommodationType', 'Alojamiento')}
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
                        placeholder={t('home.searchBar.accommodationTypePlaceholder', 'Tipo')}
                    />
                </SelectTrigger>
                <SelectContent>
                    {ACCOMMODATION_TYPE_NAMES.map((typeName) => (
                        <SelectItem
                            key={typeName}
                            value={typeName}
                        >
                            {typeName}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
