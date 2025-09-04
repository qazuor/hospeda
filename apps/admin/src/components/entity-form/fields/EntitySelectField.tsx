/**
 * @file EntitySelectField Component
 *
 * A field component for selecting entities with search functionality using the official shadcn/ui Combobox pattern.
 * This component provides a searchable dropdown for selecting entities from an API.
 */

import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import * as React from 'react';

import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { EntitySelectFieldConfig } from '@/components/entity-form/types/field-config.types';
import { Label } from '@/components/ui-wrapped';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { FieldConfig, SelectOption } from '../types/field-config.types';

/**
 * Props for the EntitySelectField component
 */
export interface EntitySelectFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: string | string[];
    /** Change handler */
    onChange?: (value: string | string[]) => void;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** Whether the field is required */
    required?: boolean;
    /** Whether the field is in a loading state */
    loading?: boolean;
    /** Whether the field has an error */
    hasError?: boolean;
    /** Error message to display */
    errorMessage?: string;
    /** Additional CSS classes */
    className?: string;
}

/**
 * EntitySelectField component using the official shadcn/ui Combobox pattern
 */
export const EntitySelectField = React.forwardRef<HTMLButtonElement, EntitySelectFieldProps>(
    (
        {
            config,
            value,
            onChange,
            disabled = false,
            required = false,
            loading = false,
            hasError = false,
            errorMessage,
            className,
            ...props
        },
        ref
    ) => {
        // Extract configuration
        const { id, label, description, placeholder, typeConfig } = config;
        const entityConfig =
            config.type === FieldTypeEnum.ENTITY_SELECT
                ? (typeConfig as EntitySelectFieldConfig)
                : null;

        // Hooks
        const { addToast } = useToast();

        // Component state
        const [open, setOpen] = React.useState(false);
        const [searchQuery, setSearchQuery] = React.useState('');
        const [searchOptions, setSearchOptions] = React.useState<SelectOption[]>([]);
        const [selectedOptions, setSelectedOptions] = React.useState<SelectOption[]>([]);
        const [allOptions, setAllOptions] = React.useState<SelectOption[]>([]); // For client-side search
        const [isSearching, setIsSearching] = React.useState(false);

        // Refs for stable function references
        const searchFnRef = React.useRef(entityConfig?.searchFn);
        const loadByIdsFnRef = React.useRef(entityConfig?.loadByIdsFn);
        const loadAllFnRef = React.useRef(entityConfig?.loadAllFn);
        const loadedValuesRef = React.useRef<string>('');
        const loadedAllRef = React.useRef<boolean>(false);
        const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

        // Update refs when functions change
        React.useEffect(() => {
            searchFnRef.current = entityConfig?.searchFn;
            loadByIdsFnRef.current = entityConfig?.loadByIdsFn;
            loadAllFnRef.current = entityConfig?.loadAllFn;
        }, [entityConfig?.searchFn, entityConfig?.loadByIdsFn, entityConfig?.loadAllFn]);

        // Determine if multiple selection is allowed
        const isMultiple = entityConfig?.multiple || false;
        const values = Array.isArray(value) ? value : value ? [value] : [];

        // IDs for accessibility
        const fieldId = `field-${id}`;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const errorId = hasError && errorMessage ? `${fieldId}-error` : undefined;

        // Load selected options by IDs
        React.useEffect(() => {
            const valuesKey = values.sort().join(',');

            // Skip if we've already loaded options for these exact values
            if (loadedValuesRef.current === valuesKey) {
                return;
            }

            if (values.length > 0) {
                // First, try to find options in our existing data (allOptions or searchOptions)
                const availableOptions = [...allOptions, ...searchOptions];
                const foundOptions = values
                    .map((val) => availableOptions.find((opt) => opt.value === val))
                    .filter(Boolean) as SelectOption[];

                // If we found all needed options locally, use them
                if (foundOptions.length === values.length) {
                    setSelectedOptions(foundOptions);
                    loadedValuesRef.current = valuesKey;
                    return;
                }

                // Only call API if we don't have all the options locally
                if (loadByIdsFnRef.current) {
                    loadByIdsFnRef
                        .current(values)
                        .then((newOptions) => {
                            // Only update if the values haven't changed while we were loading
                            const currentValuesKey = values.sort().join(',');
                            if (currentValuesKey === valuesKey) {
                                setSelectedOptions(newOptions);
                                loadedValuesRef.current = valuesKey;
                            }
                        })
                        .catch((error) => {
                            const errorMsg = `Failed to load selected ${entityConfig?.entityType?.toLowerCase() || 'options'}: ${error.message || 'Unknown error'}`;
                            addToast({
                                title: 'Error Loading Selection',
                                message: errorMsg,
                                variant: 'error'
                            });
                        });
                }
            } else if (values.length === 0) {
                // Clear options if no values
                setSelectedOptions([]);
                loadedValuesRef.current = '';
            }
        }, [values, allOptions, searchOptions, addToast, entityConfig?.entityType]);

        // Search function with debouncing (defined early to avoid hoisting issues)
        const performSearch = React.useCallback(
            async (query: string) => {
                const searchMode = entityConfig?.searchMode || 'server';

                if (searchMode === 'client') {
                    // Client-side search: filter from allOptions

                    if (query.trim() === '') {
                        // Show all options when empty if configured
                        if (entityConfig?.showAllWhenEmpty) {
                            setSearchOptions(allOptions);
                        } else {
                            setSearchOptions([]);
                        }
                        return;
                    }

                    const filtered = allOptions.filter((option) =>
                        option.label.toLowerCase().includes(query.toLowerCase())
                    );
                    setSearchOptions(filtered);
                    return;
                }

                // Server-side search
                if (!entityConfig?.searchFn) {
                    return;
                }

                const minLength = entityConfig.minSearchLength || 1;
                if (query.length < minLength) {
                    // Show all options when empty if configured and we have them
                    if (
                        query.length === 0 &&
                        entityConfig?.showAllWhenEmpty &&
                        allOptions.length > 0
                    ) {
                        setSearchOptions(allOptions);
                    } else {
                        setSearchOptions([]);
                    }
                    return;
                }

                setIsSearching(true);
                try {
                    const results = await entityConfig.searchFn(query);
                    setSearchOptions(results);
                } catch (error) {
                    const errorMsg = `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    addToast({
                        title: 'Search Error',
                        message: errorMsg,
                        variant: 'error'
                    });
                    setSearchOptions([]);
                } finally {
                    setIsSearching(false);
                }
            },
            [entityConfig, allOptions, addToast]
        );

        // Load all options for client-side search
        React.useEffect(() => {
            const searchMode = entityConfig?.searchMode || 'server';

            if (searchMode === 'client' && !loadedAllRef.current && loadAllFnRef.current) {
                loadAllFnRef
                    .current()
                    .then((options) => {
                        setAllOptions(options);
                        loadedAllRef.current = true;

                        // Always set search options when loaded in client mode
                        if (entityConfig?.showAllWhenEmpty) {
                            setSearchOptions(options);
                        }
                    })
                    .catch((error) => {
                        const errorMsg = `Failed to load ${entityConfig?.entityType?.toLowerCase() || 'options'}: ${error.message || 'Unknown error'}`;
                        addToast({
                            title: 'Error Loading Options',
                            message: errorMsg,
                            variant: 'error'
                        });
                        setAllOptions([]);
                        setSearchOptions([]);
                    });
            }
        }, [
            entityConfig?.searchMode,
            addToast,
            entityConfig?.entityType,
            entityConfig?.showAllWhenEmpty
        ]);

        // Initial search trigger for client mode
        React.useEffect(() => {
            const searchMode = entityConfig?.searchMode || 'server';

            // Trigger initial search for client mode to show all options when empty
            if (
                searchMode === 'client' &&
                entityConfig?.showAllWhenEmpty &&
                allOptions.length > 0 &&
                !searchQuery.trim()
            ) {
                setSearchOptions(allOptions);
            }
        }, [allOptions, entityConfig?.searchMode, entityConfig?.showAllWhenEmpty, searchQuery]);

        // Trigger search when popover opens
        React.useEffect(() => {
            if (
                open &&
                entityConfig?.searchMode === 'client' &&
                entityConfig?.showAllWhenEmpty &&
                !searchQuery.trim()
            ) {
                performSearch('');
            }
        }, [
            open,
            entityConfig?.searchMode,
            entityConfig?.showAllWhenEmpty,
            searchQuery,
            performSearch
        ]);

        // Initial trigger for client mode when component mounts
        React.useEffect(() => {
            const searchMode = entityConfig?.searchMode || 'server';

            if (searchMode === 'client' && entityConfig?.showAllWhenEmpty) {
                // Trigger search after a small delay to ensure everything is loaded
                setTimeout(() => {
                    performSearch('');
                }, 100);
            }
        }, [entityConfig?.searchMode, entityConfig?.showAllWhenEmpty, performSearch]); // Only run when these change

        // Debounced search effect
        React.useEffect(() => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }

            // Always perform search, even with empty query (for showAllWhenEmpty)
            searchTimeoutRef.current = setTimeout(() => {
                performSearch(searchQuery);
            }, 300);

            return () => {
                if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                }
            };
        }, [searchQuery, performSearch]);

        // Handle selection
        const handleSelect = (selectedValue: string) => {
            // Handle clear selection
            if (selectedValue === '__CLEAR_SELECTION__') {
                onChange?.(isMultiple ? [] : '');
                setOpen(false);
                return;
            }

            if (isMultiple) {
                const currentValues = Array.isArray(value) ? value : [];
                const updatedValues = currentValues.includes(selectedValue)
                    ? currentValues.filter((v) => v !== selectedValue)
                    : [...currentValues, selectedValue];
                onChange?.(updatedValues);
            } else {
                const newValue = selectedValue === value ? '' : selectedValue;
                onChange?.(newValue);
                setOpen(false);
            }
        };

        // Handle remove value (for multiple selection)
        const handleRemoveValue = (valueToRemove: string) => {
            if (isMultiple && Array.isArray(value)) {
                const updatedValues = value.filter((v) => v !== valueToRemove);
                onChange?.(updatedValues);
            }
        };

        // Get display text for selected value(s)
        const getDisplayText = () => {
            if (isMultiple) {
                return selectedOptions.length > 0
                    ? `${selectedOptions.length} selected`
                    : placeholder || 'Select items...';
            }
            const selectedOption = selectedOptions.find((opt) => opt.value === value);
            return selectedOption?.label || placeholder || 'Select item...';
        };

        // Combine search results with selected options for display
        const displayOptions = React.useMemo(() => {
            const combined = [...selectedOptions];

            // Add search results that aren't already selected
            for (const searchOption of searchOptions) {
                if (!combined.some((opt) => opt.value === searchOption.value)) {
                    combined.push(searchOption);
                }
            }

            return combined;
        }, [searchOptions, selectedOptions]);

        return (
            <div className={cn('space-y-2', className)}>
                {/* Label */}
                {label && (
                    <Label
                        htmlFor={fieldId}
                        className={cn(
                            'font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                            required && 'after:ml-0.5 after:text-red-500 after:content-["*"]',
                            hasError && 'text-red-600'
                        )}
                    >
                        {label}
                    </Label>
                )}

                {/* Description */}
                {description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-sm"
                    >
                        {description}
                    </p>
                )}

                {/* Official shadcn/ui Combobox Pattern */}
                <Popover
                    open={open}
                    onOpenChange={setOpen}
                >
                    <PopoverTrigger asChild>
                        <Button
                            ref={ref}
                            id={fieldId}
                            variant="outline"
                            // biome-ignore lint/a11y/useSemanticElements: <explanation>
                            role="combobox"
                            aria-expanded={open}
                            aria-describedby={cn(descriptionId, errorId)}
                            className={cn(
                                'w-full justify-between',
                                !value && 'text-muted-foreground',
                                hasError &&
                                    'border-red-500 focus:border-red-500 focus:ring-red-500',
                                disabled && 'cursor-not-allowed opacity-50'
                            )}
                            disabled={disabled || loading}
                            {...props}
                        >
                            <span className="truncate">{getDisplayText()}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="max-h-[300px] w-[--radix-popover-trigger-width] p-0"
                        align="start"
                    >
                        <Command shouldFilter={false}>
                            <CommandInput
                                placeholder={`Search ${entityConfig?.entityType?.toLowerCase() || 'items'}...`}
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                            />
                            <CommandList>
                                <CommandEmpty>
                                    {isSearching ? (
                                        <div className="flex items-center justify-center py-6">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Searching...
                                        </div>
                                    ) : (
                                        'No results found.'
                                    )}
                                </CommandEmpty>
                                <CommandGroup>
                                    {/* Clear option */}
                                    {entityConfig?.clearable && !isMultiple && value && (
                                        <CommandItem
                                            value="__CLEAR_SELECTION__"
                                            onSelect={handleSelect}
                                        >
                                            <span className="text-muted-foreground">
                                                Clear selection
                                            </span>
                                        </CommandItem>
                                    )}

                                    {/* Options */}
                                    {displayOptions.map((option) => (
                                        <CommandItem
                                            key={option.value}
                                            value={option.value}
                                            onSelect={handleSelect}
                                        >
                                            <Check
                                                className={cn(
                                                    'mr-2 h-4 w-4',
                                                    (
                                                        isMultiple
                                                            ? values.includes(option.value)
                                                            : value === option.value
                                                    )
                                                        ? 'opacity-100'
                                                        : 'opacity-0'
                                                )}
                                            />
                                            <span>{option.label}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                {/* Selected badges for multiple selection */}
                {isMultiple && selectedOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {selectedOptions
                            .filter((option) => values.includes(option.value))
                            .map((option) => (
                                <div
                                    key={option.value}
                                    className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-secondary-foreground text-xs"
                                >
                                    <span>{option.label}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveValue(option.value)}
                                        className="rounded p-0.5 hover:bg-secondary-foreground/20"
                                        disabled={disabled}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                    </div>
                )}

                {/* Loading indicator */}
                {loading && (
                    <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2 text-muted-foreground text-sm">Loading...</span>
                    </div>
                )}

                {/* Error message */}
                {/* Field validation error */}
                {hasError && errorMessage && (
                    <p
                        id={errorId}
                        className="text-red-600 text-sm"
                    >
                        {errorMessage}
                    </p>
                )}
            </div>
        );
    }
);

EntitySelectField.displayName = 'EntitySelectField';
