import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@repo/icons';
import * as React from 'react';
import { type DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker';

/** Cached default class names to avoid recalculation per render */
const defaultClassNamesCache = getDefaultClassNames();

/** Calendar component wrapping react-day-picker with custom styling */
function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    captionLayout = 'label',
    buttonVariant = 'ghost',
    formatters,
    components,
    ...props
}: React.ComponentProps<typeof DayPicker> & {
    buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn(
                'group/calendar bg-background p-3 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent',
                String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
                String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
                className
            )}
            captionLayout={captionLayout}
            formatters={{
                formatMonthDropdown: (date) => date.toLocaleString('default', { month: 'short' }),
                ...formatters
            }}
            classNames={{
                root: cn('w-fit', defaultClassNamesCache.root),
                months: cn(
                    'flex gap-4 flex-col md:flex-row relative',
                    defaultClassNamesCache.months
                ),
                month: cn('flex flex-col w-full gap-4', defaultClassNamesCache.month),
                nav: cn(
                    'flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between',
                    defaultClassNamesCache.nav
                ),
                button_previous: cn(
                    buttonVariants({ variant: buttonVariant }),
                    'size-(--cell-size) aria-disabled:opacity-50 p-0 select-none',
                    defaultClassNamesCache.button_previous
                ),
                button_next: cn(
                    buttonVariants({ variant: buttonVariant }),
                    'size-(--cell-size) aria-disabled:opacity-50 p-0 select-none',
                    defaultClassNamesCache.button_next
                ),
                month_caption: cn(
                    'flex items-center justify-center h-(--cell-size) w-full px-(--cell-size)',
                    defaultClassNamesCache.month_caption
                ),
                dropdowns: cn(
                    'w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5',
                    defaultClassNamesCache.dropdowns
                ),
                dropdown_root: cn(
                    'relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md',
                    defaultClassNamesCache.dropdown_root
                ),
                dropdown: cn(
                    'absolute bg-popover inset-0 opacity-0',
                    defaultClassNamesCache.dropdown
                ),
                caption_label: cn(
                    'select-none font-medium',
                    captionLayout === 'label'
                        ? 'text-sm'
                        : 'rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5',
                    defaultClassNamesCache.caption_label
                ),
                table: 'w-full border-collapse',
                weekdays: cn('flex', defaultClassNamesCache.weekdays),
                weekday: cn(
                    'text-muted-foreground rounded-md flex-1 font-normal text-3xs select-none',
                    defaultClassNamesCache.weekday
                ),
                week: cn('flex w-full mt-2', defaultClassNamesCache.week),
                week_number_header: cn(
                    'select-none w-(--cell-size)',
                    defaultClassNamesCache.week_number_header
                ),
                week_number: cn(
                    'text-3xs select-none text-muted-foreground',
                    defaultClassNamesCache.week_number
                ),
                day: cn(
                    'relative w-full h-full p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none',
                    defaultClassNamesCache.day
                ),
                range_start: cn('rounded-l-md bg-accent', defaultClassNamesCache.range_start),
                range_middle: cn('rounded-none', defaultClassNamesCache.range_middle),
                range_end: cn('rounded-r-md bg-accent', defaultClassNamesCache.range_end),
                today: cn(
                    'bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none',
                    defaultClassNamesCache.today
                ),
                outside: cn(
                    'text-muted-foreground aria-selected:text-muted-foreground',
                    defaultClassNamesCache.outside
                ),
                disabled: cn('text-muted-foreground opacity-50', defaultClassNamesCache.disabled),
                hidden: cn('invisible', defaultClassNamesCache.hidden),
                ...classNames
            }}
            components={{
                Root: ({ className: rootClassName, rootRef, ...rootProps }) => {
                    return (
                        <div
                            data-slot="calendar"
                            ref={rootRef}
                            className={cn(rootClassName)}
                            {...rootProps}
                        />
                    );
                },
                Chevron: ({ className: chevClassName, orientation, ...chevProps }) => {
                    if (orientation === 'left')
                        return (
                            <ChevronLeftIcon
                                size={16}
                                className={cn(chevClassName)}
                                {...chevProps}
                            />
                        );
                    if (orientation === 'right')
                        return (
                            <ChevronRightIcon
                                size={16}
                                className={cn(chevClassName)}
                                {...chevProps}
                            />
                        );
                    return (
                        <ChevronDownIcon
                            size={16}
                            className={cn(chevClassName)}
                            {...chevProps}
                        />
                    );
                },
                DayButton: CalendarDayButton,
                WeekNumber: ({ children, ...wnProps }) => {
                    return (
                        <td {...wnProps}>
                            <div className="flex size-(--cell-size) items-center justify-center text-center">
                                {children}
                            </div>
                        </td>
                    );
                },
                ...components
            }}
            {...props}
        />
    );
}

function CalendarDayButton({
    className,
    day,
    modifiers,
    ...props
}: React.ComponentProps<typeof DayButton>) {
    const ref = React.useRef<HTMLButtonElement>(null);
    React.useEffect(() => {
        if (modifiers.focused) ref.current?.focus();
    }, [modifiers.focused]);

    return (
        <Button
            ref={ref}
            variant="ghost"
            size="icon"
            data-day={day.date.toLocaleDateString()}
            data-selected-single={
                modifiers.selected &&
                !modifiers.range_start &&
                !modifiers.range_end &&
                !modifiers.range_middle
            }
            data-range-start={modifiers.range_start}
            data-range-end={modifiers.range_end}
            data-range-middle={modifiers.range_middle}
            className={cn(
                'flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-start=true]:rounded-l-md data-[range-end=true]:bg-primary data-[range-middle=true]:bg-accent data-[range-start=true]:bg-primary data-[selected-single=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:text-accent-foreground data-[range-start=true]:text-primary-foreground data-[selected-single=true]:text-primary-foreground group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 [&>span]:text-xs [&>span]:opacity-70',
                defaultClassNamesCache.day,
                className
            )}
            {...props}
        />
    );
}

export { Calendar, CalendarDayButton };
