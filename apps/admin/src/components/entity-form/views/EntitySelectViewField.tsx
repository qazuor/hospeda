import type { FieldConfig, SelectOption } from '@/components/entity-form/types/field-config.types';
import { Badge, Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';

import { ExternalLink } from 'lucide-react';
import * as React from 'react';

/**
 * Props for EntitySelectViewField component
 */
export interface EntitySelectViewFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: string | string[];
    /** Options for the entities */
    options?: SelectOption[];
    /** Additional CSS classes */
    className?: string;
    /** Whether to show the label */
    showLabel?: boolean;
    /** Whether to show the description */
    showDescription?: boolean;
    /** Whether to show as badges for multiple values */
    showAsBadges?: boolean;
    /** Whether to show links to entity pages */
    showLinks?: boolean;
    /** Link generator function */
    getLinkUrl?: (entityId: string, entityType: string) => string;
    /** Loading state */
    loading?: boolean;
}

/**
 * EntitySelectViewField component for displaying selected entities
 * Handles ENTITY_SELECT field type in view mode
 */
export const EntitySelectViewField = React.forwardRef<HTMLDivElement, EntitySelectViewFieldProps>(
    (
        {
            config,
            value,
            options = [],
            className,
            showLabel = true,
            showDescription = false,
            showAsBadges = true,
            showLinks = false,
            getLinkUrl,
            loading = false,
            ...props
        },
        ref
    ) => {
        // Use direct translations from config
        const label = config.label;
        const description = config.description;

        // Get entity select specific config
        const entityConfig =
            config.typeConfig?.type === 'ENTITY_SELECT' ? config.typeConfig : undefined;

        const fieldId = `view-field-${config.id}`;
        const descriptionId = description ? `${fieldId}-description` : undefined;

        // Handle both single and multiple values
        const values = Array.isArray(value) ? value : value ? [value] : [];
        const isMultiple = entityConfig?.multiple || Array.isArray(value);

        // Find selected options
        const selectedOptions = values
            .map((val) => options.find((option) => option.value === val))
            .filter(Boolean) as SelectOption[];

        const renderEntityLink = (option: SelectOption) => {
            if (!showLinks || !getLinkUrl || !entityConfig?.entityType) {
                return option.label;
            }

            const linkUrl = getLinkUrl(option.value, entityConfig.entityType);

            return (
                <a
                    href={linkUrl}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {option.label}
                    <ExternalLink className="h-3 w-3" />
                </a>
            );
        };

        const renderValue = () => {
            if (loading) {
                return (
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                        <span className="text-muted-foreground text-sm">Loading...</span>
                    </div>
                );
            }

            if (selectedOptions.length === 0) {
                return <span className="text-muted-foreground italic">No selection</span>;
            }

            if (showAsBadges || isMultiple) {
                return (
                    <div className="flex flex-wrap gap-1">
                        {selectedOptions.map((option) => (
                            <Badge
                                key={option.value}
                                variant="secondary"
                                className="text-xs"
                            >
                                {(() => {
                                    const icon = option.metadata?.icon;
                                    if (icon && typeof icon === 'string') {
                                        return (
                                            <>
                                                <span className="mr-1">{icon}</span>
                                                {renderEntityLink(option)}
                                            </>
                                        );
                                    }
                                    return renderEntityLink(option);
                                })()}
                            </Badge>
                        ))}
                    </div>
                );
            }

            const option = selectedOptions[0];
            return (
                <div className="flex items-center gap-2">
                    {(() => {
                        const icon = option.metadata?.icon;
                        if (icon && typeof icon === 'string') {
                            return <span className="text-muted-foreground">{icon}</span>;
                        }
                        return null;
                    })()}

                    <div className="flex flex-col">
                        <span>{renderEntityLink(option)}</span>
                        {option.description && (
                            <span className="text-muted-foreground text-xs">
                                {option.description}
                            </span>
                        )}
                    </div>

                    {(() => {
                        const status = option.metadata?.status;
                        if (!status) return null;
                        return (
                            <Badge
                                variant={
                                    String(status) === 'active'
                                        ? 'default'
                                        : String(status) === 'inactive'
                                          ? 'secondary'
                                          : 'outline'
                                }
                                className="text-xs"
                            >
                                {String(status)}
                            </Badge>
                        );
                    })()}
                </div>
            );
        };

        return (
            <div
                ref={ref}
                className={cn('space-y-1', className)}
                {...props}
            >
                {/* Label */}
                {showLabel && label && (
                    <Label className="font-medium text-muted-foreground text-sm">{label}</Label>
                )}

                {/* Description */}
                {showDescription && description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-xs"
                    >
                        {description}
                    </p>
                )}

                {/* Value */}
                <div
                    className={cn('text-sm', config.className)}
                    aria-describedby={descriptionId}
                >
                    {renderValue()}
                </div>

                {/* Entity Type Info */}
                {entityConfig?.entityType && selectedOptions.length > 0 && (
                    <div className="text-muted-foreground text-xs">
                        {isMultiple
                            ? `${selectedOptions.length} ${entityConfig.entityType.toLowerCase()}(s) selected`
                            : `${entityConfig.entityType.toLowerCase()}`}
                    </div>
                )}
            </div>
        );
    }
);

EntitySelectViewField.displayName = 'EntitySelectViewField';
