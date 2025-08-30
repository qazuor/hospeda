import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Accordion section configuration
 */
export interface AccordionSectionConfig {
    /** Unique section identifier */
    id: string;
    /** Section title */
    title: string;
    /** Section content */
    content: React.ReactNode;
    /** Whether section is disabled */
    disabled?: boolean;
    /** Icon for the section */
    icon?: React.ReactNode;
    /** Badge content */
    badge?: React.ReactNode;
    /** Whether section is initially open */
    defaultOpen?: boolean;
}

/**
 * Props for AccordionLayout component
 */
export interface AccordionLayoutProps {
    /** Accordion section configurations */
    sections: AccordionSectionConfig[];
    /** Accordion type - single or multiple sections can be open */
    type?: 'single' | 'multiple';
    /** Default open sections (for multiple type) */
    defaultValue?: string | string[];
    /** Controlled open sections */
    value?: string | string[];
    /** Section change handler */
    onValueChange?: (value: string | string[]) => void;
    /** Whether sections are collapsible (for single type) */
    collapsible?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Additional CSS classes for accordion items */
    itemClassName?: string;
    /** Additional CSS classes for accordion triggers */
    triggerClassName?: string;
    /** Additional CSS classes for accordion content */
    contentClassName?: string;
}

/**
 * AccordionLayout component for organizing form sections in collapsible accordion
 * Provides accordion interface with configurable behavior and styling
 */
export const AccordionLayout = React.forwardRef<HTMLDivElement, AccordionLayoutProps>(
    (
        {
            sections,
            type = 'multiple',
            defaultValue,
            value,
            onValueChange,
            collapsible = true,
            className,
            itemClassName,
            triggerClassName,
            contentClassName,
            ...props
        },
        ref
    ) => {
        // Generate default value based on defaultOpen sections
        const effectiveDefaultValue = React.useMemo(() => {
            if (defaultValue !== undefined) return defaultValue;

            const defaultOpenSections = sections
                .filter((section) => section.defaultOpen)
                .map((section) => section.id);

            if (type === 'single') {
                return defaultOpenSections[0] || '';
            }

            return defaultOpenSections;
        }, [defaultValue, sections, type]);

        return (
            <div
                ref={ref}
                className={cn('w-full', className)}
                {...props}
            >
                {type === 'single' ? (
                    <Accordion
                        type="single"
                        defaultValue={effectiveDefaultValue as string}
                        value={value as string}
                        onValueChange={onValueChange as (value: string) => void}
                        collapsible={collapsible}
                        className="w-full"
                    >
                        {sections.map((section) => (
                            <AccordionItem
                                key={section.id}
                                value={section.id}
                                disabled={section.disabled}
                                className={cn(itemClassName)}
                            >
                                <AccordionTrigger
                                    className={cn(
                                        'flex items-center gap-2 hover:no-underline',
                                        section.disabled && 'cursor-not-allowed opacity-50',
                                        triggerClassName
                                    )}
                                >
                                    <div className="flex flex-1 items-center gap-2">
                                        {section.icon && (
                                            <span className="flex-shrink-0">{section.icon}</span>
                                        )}
                                        <span className="truncate text-left">{section.title}</span>
                                        {section.badge && (
                                            <span className="flex-shrink-0">{section.badge}</span>
                                        )}
                                    </div>
                                </AccordionTrigger>

                                <AccordionContent className={cn('pt-4 pb-4', contentClassName)}>
                                    {section.content}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <Accordion
                        type="multiple"
                        defaultValue={effectiveDefaultValue as string[]}
                        value={value as string[]}
                        onValueChange={onValueChange as (value: string[]) => void}
                        className="w-full"
                    >
                        {sections.map((section) => (
                            <AccordionItem
                                key={section.id}
                                value={section.id}
                                disabled={section.disabled}
                                className={cn(itemClassName)}
                            >
                                <AccordionTrigger
                                    className={cn(
                                        'flex items-center gap-2 hover:no-underline',
                                        section.disabled && 'cursor-not-allowed opacity-50',
                                        triggerClassName
                                    )}
                                >
                                    <div className="flex flex-1 items-center gap-2">
                                        {section.icon && (
                                            <span className="flex-shrink-0">{section.icon}</span>
                                        )}
                                        <span className="truncate text-left">{section.title}</span>
                                        {section.badge && (
                                            <span className="flex-shrink-0">{section.badge}</span>
                                        )}
                                    </div>
                                </AccordionTrigger>

                                <AccordionContent className={cn('pt-4 pb-4', contentClassName)}>
                                    {section.content}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </div>
        );
    }
);

AccordionLayout.displayName = 'AccordionLayout';
