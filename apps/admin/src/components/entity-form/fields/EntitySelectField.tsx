import type { FieldConfig, SelectOption } from '@/components/entity-form/types/field-config.types';
import {
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { useFieldI18n } from '@/lib/utils/i18n-field.utils';
import { Loader2, Search, X } from 'lucide-react';
import * as React from 'react';

/**
 * Props for EntitySelectField component
 */
export interface EntitySelectFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: string | string[];
    /** Change handler */
    onChange?: (value: string | string[]) => void;
    /** Blur handler */
    onBlur?: () => void;
    /** Focus handler */
    onFocus?: () => void;
    /** Whether the field has an error */
    hasError?: boolean;
    /** Error message to display */
    errorMessage?: string;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** Whether the field is required */
    required?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Loading state */
    loading?: boolean;
}

/**
 * EntitySelectField component for selecting entities with search functionality
 * Handles ENTITY_SELECT and ENTITY_MULTISELECT field types from FieldConfig
 */
export const EntitySelectField = React.forwardRef<HTMLButtonElement, EntitySelectFieldProps>(
    (
        {
            config,
            value,
            onChange,
            onBlur,
            onFocus,
            hasError = false,
            errorMessage,
            disabled = false,
            required = false,
            className,
            loading = false,
            ...props
        },
        ref
    ) => {
        const { label, description, placeholder, helper } = useFieldI18n(config.id, config.i18n);

        // Get entity select specific config
        const entityConfig =
            config.typeConfig?.type === 'ENTITY_SELECT' ? config.typeConfig : undefined;

        // State for search and options
        const [searchQuery, setSearchQuery] = React.useState('');
        const [options, setOptions] = React.useState<SelectOption[]>([]);
        const [isSearching, setIsSearching] = React.useState(false);
        const [isOpen, setIsOpen] = React.useState(false);

        // Debounced search
        const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        const isMultiple = entityConfig?.multiple || false;
        const values = Array.isArray(value) ? value : value ? [value] : [];

        // Search function
        const performSearch = React.useCallback(
            async (query: string) => {
                if (!entityConfig?.searchFn) return;

                const minLength = entityConfig.minSearchLength || 2;
                if (query.length < minLength) {
                    setOptions([]);
                    return;
                }

                setIsSearching(true);
                try {
                    const results = await entityConfig.searchFn(query);
                    setOptions(results);
                } catch (error) {
                    console.error('Entity search error:', error);
                    setOptions([]);
                } finally {
                    setIsSearching(false);
                }
            },
            [entityConfig]
        );

        // Debounced search effect
        React.useEffect(() => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }

            const debounceMs = entityConfig?.searchDebounceMs || 300;
            searchTimeoutRef.current = setTimeout(() => {
                performSearch(searchQuery);
            }, debounceMs);

            return () => {
                if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                }
            };
        }, [searchQuery, performSearch, entityConfig?.searchDebounceMs]);

        // Load selected options by IDs
        React.useEffect(() => {
            if (values.length > 0 && entityConfig?.loadByIdsFn) {
                entityConfig.loadByIdsFn(values).then(setOptions).catch(console.error);
            }
        }, [values, entityConfig?.loadByIdsFn]);

        const handleValueChange = (newValue: string) => {
            if (isMultiple) {
                const currentValues = Array.isArray(value) ? value : [];
                const updatedValues = currentValues.includes(newValue)
                    ? currentValues.filter((v) => v !== newValue)
                    : [...currentValues, newValue];
                onChange?.(updatedValues);
            } else {
                onChange?.(newValue);
                setIsOpen(false);
            }
        };

        const handleRemoveValue = (valueToRemove: string) => {
            if (isMultiple && Array.isArray(value)) {
                const updatedValues = value.filter((v) => v !== valueToRemove);
                onChange?.(updatedValues);
            }
        };

        const selectedOptions = options.filter((option) => values.includes(option.value));

        const renderSelectedValue = () => {
            if (selectedOptions.length === 0) {
                return placeholder || 'Select...';
            }

            if (isMultiple) {
                return `${selectedOptions.length} selected`;
            }

            return selectedOptions[0]?.label;
        };

        const renderSelectedBadges = () => {
            if (!isMultiple || selectedOptions.length === 0) return null;

            return (
                <div className="mt-2 flex flex-wrap gap-1">
                    {selectedOptions.map((option) => (
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
            );
        };

        return (
            <div className={cn('space-y-2', className)}>
                {/* Label */}
                {label && (
                    <Label
                        htmlFor={fieldId}
                        className={cn(
                            required && 'after:ml-0.5 after:text-destructive after:content-["*"]'
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

                {/* Select Field */}
                <Select
                    value={isMultiple ? '' : (value as string) || ''}
                    onValueChange={handleValueChange}
                    disabled={disabled || loading}
                    required={required}
                    open={isOpen}
                    onOpenChange={setIsOpen}
                    {...props}
                >
                    <SelectTrigger
                        ref={ref}
                        id={fieldId}
                        className={cn(
                            hasError && 'border-destructive focus:ring-destructive',
                            config.className
                        )}
                        aria-invalid={hasError}
                        aria-describedby={cn(errorId, descriptionId, helperId).trim() || undefined}
                        onBlur={onBlur}
                        onFocus={onFocus}
                    >
                        <SelectValue>
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                </div>
                            ) : (
                                renderSelectedValue()
                            )}
                        </SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                        {/* Search Input */}
                        {entityConfig?.searchable && (
                            <div className="flex items-center border-b px-3 pb-2">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    className="flex h-8 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Clear option if allowed */}
                        {entityConfig?.clearable && !isMultiple && value && (
                            <SelectItem value="">
                                <span className="text-muted-foreground">Clear selection</span>
                            </SelectItem>
                        )}

                        {/* Loading state */}
                        {isSearching && (
                            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                            </div>
                        )}

                        {/* Options */}
                        {!isSearching &&
                            options.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    disabled={option.disabled}
                                    className={cn(
                                        option.disabled && 'cursor-not-allowed opacity-50',
                                        isMultiple && values.includes(option.value) && 'bg-accent'
                                    )}
                                >
                                    <div className="flex w-full items-center gap-2">
                                        {(() => {
                                            const icon = option.metadata?.icon;
                                            if (icon && typeof icon === 'string') {
                                                return (
                                                    <span className="text-muted-foreground">
                                                        {icon}
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })()}

                                        <div className="flex flex-1 flex-col">
                                            <span>{option.label}</span>
                                            {option.description && (
                                                <span className="text-muted-foreground text-xs">
                                                    {option.description}
                                                </span>
                                            )}
                                        </div>

                                        {isMultiple && values.includes(option.value) && (
                                            <div className="ml-auto">
                                                <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-primary">
                                                    <div className="h-2 w-2 rounded-sm bg-primary-foreground" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}

                        {/* Empty state */}
                        {!isSearching && options.length === 0 && searchQuery && (
                            <div className="py-6 text-center text-muted-foreground text-sm">
                                No results found for "{searchQuery}"
                            </div>
                        )}

                        {/* No search query state */}
                        {!isSearching &&
                            options.length === 0 &&
                            !searchQuery &&
                            entityConfig?.searchable && (
                                <div className="py-6 text-center text-muted-foreground text-sm">
                                    Start typing to search...
                                </div>
                            )}
                    </SelectContent>
                </Select>

                {/* Selected badges for multiple selection */}
                {renderSelectedBadges()}

                {/* Helper Text */}
                {helper && !hasError && (
                    <p
                        id={helperId}
                        className="text-muted-foreground text-sm"
                    >
                        {helper}
                    </p>
                )}

                {/* Error Message */}
                {hasError && errorMessage && (
                    <p
                        id={errorId}
                        className="text-destructive text-sm"
                    >
                        {errorMessage}
                    </p>
                )}
            </div>
        );
    }
);

EntitySelectField.displayName = 'EntitySelectField';
