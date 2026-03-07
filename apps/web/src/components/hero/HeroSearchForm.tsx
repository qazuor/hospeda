/**
 * @file HeroSearchForm.tsx
 * @description React island component for the hero section search form.
 * Renders a responsive search bar with destination, accommodation type,
 * guests, and date range fields. Desktop uses an inline bar with popovers;
 * mobile uses a full-screen drawer. Hydrated via `client:idle` in Astro.
 */
import { GuestCounter } from '@/components/shared/GuestCounter';
import { SearchFieldDestination } from '@/components/shared/SearchFieldDestination';
import { SearchFieldType } from '@/components/shared/SearchFieldType';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger
} from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type SearchFormState, useSearchForm } from '@/hooks/use-search-form';
import { DEFAULT_LOCALE, createT } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { CalendarDotsIcon, SearchIcon, UsersIcon } from '@repo/icons';
import { es } from 'date-fns/locale';

/**
 * Props for the HeroSearchForm component.
 * @property locale - Current locale for translations and date formatting
 */
interface HeroSearchFormProps {
    readonly locale?: SupportedLocale;
}

/**
 * Renders a compact label with an icon for search form fields.
 * Used above each field in both desktop and mobile layouts.
 *
 * @param props - Component props
 * @param props.icon - Icon component from @repo/icons to render
 * @param props.label - Label text displayed next to the icon
 */
function FieldLabel({
    icon: Icon,
    label
}: { readonly icon: typeof UsersIcon; readonly label: string }) {
    return (
        <span className="mb-1.5 flex items-center gap-1.5 font-semibold text-hero-text-muted text-xs uppercase tracking-wider">
            <Icon
                size={12}
                weight="regular"
                color="currentColor"
            />
            {label}
        </span>
    );
}

/**
 * Popover for selecting number of guests (adults + children).
 * Contains two GuestCounter stepper controls and a "Done" button.
 *
 * @param props - Component props
 * @param props.form - Search form state from useSearchForm hook
 * @param props.triggerClass - CSS classes for the popover trigger button
 * @param props.locale - Current locale for translations
 */
function GuestsPopover({
    form,
    triggerClass,
    locale
}: {
    readonly form: SearchFormState;
    readonly triggerClass: string;
    readonly locale: SupportedLocale;
}) {
    const t = createT(locale);
    return (
        <Popover
            open={form.guestsOpen}
            onOpenChange={form.setGuestsOpen}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={triggerClass}
                >
                    {form.guestsLabel}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-72"
                align="start"
            >
                <GuestCounter
                    label={t('home.searchBar.adults', 'Adultos')}
                    sublabel={t('home.searchBar.adultsSubLabel', '13 anos o mas')}
                    value={form.adults}
                    min={1}
                    onIncrement={form.incrementAdults}
                    onDecrement={form.decrementAdults}
                    locale={locale}
                />
                <div className="my-1 h-px bg-border" />
                <GuestCounter
                    label={t('home.searchBar.children', 'Ninos')}
                    sublabel={t('home.searchBar.childrenSubLabel', '0 a 12 anos')}
                    value={form.children}
                    min={0}
                    onIncrement={form.incrementChildren}
                    onDecrement={form.decrementChildren}
                    locale={locale}
                />
                <Button
                    size="sm"
                    className="mt-3 w-full bg-primary text-primary-foreground"
                    onClick={() => form.setGuestsOpen(false)}
                >
                    {t('home.searchBar.done', 'Listo')}
                </Button>
            </PopoverContent>
        </Popover>
    );
}

/**
 * Popover for selecting check-in/check-out date range.
 * Uses react-day-picker Calendar in range mode with configurable month count.
 *
 * @param props - Component props
 * @param props.form - Search form state from useSearchForm hook
 * @param props.triggerClass - CSS classes for the popover trigger button
 * @param props.numberOfMonths - Number of months to display (2 for desktop, 1 for mobile)
 * @param props.align - Popover alignment relative to trigger
 */
function DatesPopover({
    form,
    triggerClass,
    numberOfMonths,
    align
}: {
    readonly form: SearchFormState;
    readonly triggerClass: string;
    readonly numberOfMonths: number;
    readonly align: 'start' | 'center' | 'end';
}) {
    return (
        <Popover
            open={form.datesOpen}
            onOpenChange={form.setDatesOpen}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={triggerClass}
                >
                    {form.datesLabel}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0"
                align={align}
            >
                <Calendar
                    mode="range"
                    selected={form.dateRange}
                    onSelect={form.setDateRange}
                    numberOfMonths={numberOfMonths}
                    disabled={{ before: new Date() }}
                    locale={es}
                />
            </PopoverContent>
        </Popover>
    );
}

/**
 * Hero search form with responsive desktop/mobile layouts.
 * Desktop (lg+): inline bar with popovers for each field.
 * Mobile (<lg): single button that opens a full-screen Drawer with all fields.
 *
 * @param props - Component props
 * @param props.locale - Current locale for translations and date formatting
 */
export function HeroSearchForm({ locale = DEFAULT_LOCALE }: HeroSearchFormProps) {
    const t = createT(locale);
    const form = useSearchForm({ locale });

    return (
        <div className="mx-auto w-full max-w-5xl">
            {/* Desktop layout */}
            <div className="hidden items-end gap-0 rounded-2xl border border-hero-border bg-hero-overlay p-2 shadow-search backdrop-blur-md lg:flex">
                <SearchFieldDestination
                    value={form.destination}
                    onValueChange={form.setDestination}
                    variant="desktop"
                    locale={locale}
                />

                <div
                    className="h-10 w-px self-center bg-hero-border"
                    aria-hidden="true"
                />

                <SearchFieldType
                    value={form.accommodationType}
                    onValueChange={form.setAccommodationType}
                    variant="desktop"
                    locale={locale}
                />

                <div
                    className="h-10 w-px self-center bg-hero-border"
                    aria-hidden="true"
                />

                {/* Guests */}
                <div className="flex-1 px-3 py-1">
                    <FieldLabel
                        icon={UsersIcon}
                        label={t('home.searchBar.guests', 'Huespedes')}
                    />
                    <GuestsPopover
                        form={form}
                        triggerClass="flex h-9 w-full items-center text-sm text-hero-text hover:text-hero-text-secondary transition-colors"
                        locale={locale}
                    />
                </div>

                <div
                    className="h-10 w-px self-center bg-hero-border"
                    aria-hidden="true"
                />

                {/* Dates */}
                <div className="flex-1 px-3 py-1">
                    <FieldLabel
                        icon={CalendarDotsIcon}
                        label={t('home.searchBar.dates', 'Fechas')}
                    />
                    <DatesPopover
                        form={form}
                        triggerClass="flex h-9 w-full items-center text-sm text-hero-text hover:text-hero-text-secondary transition-colors"
                        numberOfMonths={2}
                        align="end"
                    />
                </div>

                {/* Search button */}
                <div className="py-1 pr-1 pl-2">
                    <Button
                        size="lg"
                        className="h-12 rounded-xl bg-accent px-6 text-accent-foreground shadow-lg hover:bg-accent/90"
                    >
                        <SearchIcon
                            size={16}
                            weight="regular"
                            color="currentColor"
                            className="mr-2"
                        />
                        {t('home.searchBar.search', 'Buscar')}
                    </Button>
                </div>
            </div>

            {/* Mobile: Single button that opens drawer */}
            <div className="lg:hidden">
                <Drawer
                    open={form.drawerOpen}
                    onOpenChange={form.setDrawerOpen}
                >
                    <DrawerTrigger asChild>
                        <Button
                            size="lg"
                            className="mx-auto flex h-14 w-full max-w-md rounded-full border border-hero-border bg-hero-overlay font-medium text-base text-hero-text shadow-search backdrop-blur-md hover:bg-hero-overlay-heavy"
                        >
                            <SearchIcon
                                size={20}
                                weight="regular"
                                color="currentColor"
                                className="mr-3 text-hero-text-muted"
                            />
                            {t('home.searchBar.searchAccommodation', 'Buscar alojamiento')}
                        </Button>
                    </DrawerTrigger>
                    <DrawerContent className="max-h-[90vh]">
                        <DrawerHeader>
                            <DrawerTitle className="text-lg">
                                {t('home.searchBar.searchAccommodation', 'Buscar alojamiento')}
                            </DrawerTitle>
                        </DrawerHeader>
                        <div className="overflow-y-auto px-4 pb-2">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <SearchFieldDestination
                                    value={form.destination}
                                    onValueChange={form.setDestination}
                                    variant="mobile"
                                    locale={locale}
                                />
                                <SearchFieldType
                                    value={form.accommodationType}
                                    onValueChange={form.setAccommodationType}
                                    variant="mobile"
                                    locale={locale}
                                />

                                {/* Guests */}
                                <div>
                                    <FieldLabel
                                        icon={UsersIcon}
                                        label={t('home.searchBar.guests', 'Huespedes')}
                                    />
                                    <GuestsPopover
                                        form={form}
                                        triggerClass="flex h-11 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-foreground shadow-xs"
                                        locale={locale}
                                    />
                                </div>

                                {/* Dates */}
                                <div>
                                    <FieldLabel
                                        icon={CalendarDotsIcon}
                                        label={t('home.searchBar.dates', 'Fechas')}
                                    />
                                    <DatesPopover
                                        form={form}
                                        triggerClass="flex h-11 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-foreground shadow-xs"
                                        numberOfMonths={1}
                                        align="center"
                                    />
                                </div>
                            </div>
                        </div>
                        <DrawerFooter>
                            <Button className="h-12 w-full rounded-xl bg-accent text-accent-foreground text-base shadow-lg hover:bg-accent/90">
                                <SearchIcon
                                    size={16}
                                    weight="regular"
                                    color="currentColor"
                                    className="mr-2"
                                />
                                {t('home.searchBar.search', 'Buscar')}
                            </Button>
                            <DrawerClose asChild>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                >
                                    {t('home.searchBar.cancel', 'Cancelar')}
                                </Button>
                            </DrawerClose>
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>
            </div>
        </div>
    );
}
