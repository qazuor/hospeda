/**
 * AppLogFilters
 *
 * Filter bar for the app log viewer: level select, category text input,
 * and from/to date inputs.  Changing any filter resets the page to 1 via
 * the provided `onChange` callback.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import type { AppLogEntryFilter, AppLogEntryLevel } from '../types';

/** Props for AppLogFilters */
export interface AppLogFiltersProps {
    /** Current active filter state */
    readonly filter: AppLogEntryFilter;
    /** Called when any filter field changes (page is reset to 1 automatically) */
    readonly onChange: (next: AppLogEntryFilter) => void;
}

/** Sentinel value used in the level <Select> to represent "no filter". */
const ALL_LEVELS = '__all__';

/**
 * Renders the filter controls bar for the app log viewer.
 *
 * @param props - Component props.
 */
export function AppLogFilters({ filter, onChange }: AppLogFiltersProps) {
    const handleLevelChange = (value: string) => {
        const level = value === ALL_LEVELS ? undefined : (value as AppLogEntryLevel);
        onChange({ ...filter, level, page: 1 });
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const category = e.target.value.trim() || undefined;
        onChange({ ...filter, category, page: 1 });
    };

    const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fromDate = e.target.value ? new Date(e.target.value) : undefined;
        onChange({ ...filter, fromDate, page: 1 });
    };

    const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const toDate = e.target.value ? new Date(e.target.value) : undefined;
        onChange({ ...filter, toDate, page: 1 });
    };

    /** Converts a Date or undefined to an ISO date-input value (YYYY-MM-DD). */
    const toDateInputValue = (date: Date | undefined): string => {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        return d.toISOString().slice(0, 10);
    };

    return (
        <div className="flex flex-wrap gap-4">
            {/* Level filter */}
            <div className="flex min-w-36 flex-col gap-1">
                <Label htmlFor="log-filter-level">Nivel</Label>
                <Select
                    value={filter.level ?? ALL_LEVELS}
                    onValueChange={handleLevelChange}
                >
                    <SelectTrigger
                        id="log-filter-level"
                        data-testid="log-filter-level"
                        className="h-9 text-sm"
                    >
                        <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_LEVELS}>Todos</SelectItem>
                        <SelectItem value="WARN">WARN</SelectItem>
                        <SelectItem value="ERROR">ERROR</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Category filter */}
            <div className="flex min-w-44 flex-col gap-1">
                <Label htmlFor="log-filter-category">Categoría</Label>
                <Input
                    id="log-filter-category"
                    data-testid="log-filter-category"
                    type="text"
                    placeholder="Ej: BILLING"
                    defaultValue={filter.category ?? ''}
                    onChange={handleCategoryChange}
                    className="h-9 text-sm"
                />
            </div>

            {/* From date filter */}
            <div className="flex min-w-40 flex-col gap-1">
                <Label htmlFor="log-filter-from">Desde</Label>
                <Input
                    id="log-filter-from"
                    data-testid="log-filter-from"
                    type="date"
                    value={toDateInputValue(filter.fromDate)}
                    onChange={handleFromDateChange}
                    className="h-9 text-sm"
                />
            </div>

            {/* To date filter */}
            <div className="flex min-w-40 flex-col gap-1">
                <Label htmlFor="log-filter-to">Hasta</Label>
                <Input
                    id="log-filter-to"
                    data-testid="log-filter-to"
                    type="date"
                    value={toDateInputValue(filter.toDate)}
                    onChange={handleToDateChange}
                    className="h-9 text-sm"
                />
            </div>
        </div>
    );
}
