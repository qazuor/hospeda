/**
 * @file AccordionLayout Renderer
 *
 * Renders content in an accordion interface using Shadcn Accordion component.
 * Supports multiple expansion, default expanded sections, and different variants.
 */

import { Icon } from '@/components/icons';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { memo, useMemo } from 'react';
import type { AccordionLayoutConfig, LayoutRendererContext } from '../../types';

/**
 * Accordion layout renderer component
 */
export const AccordionLayout = memo(
    <TData = unknown>({ layout, sections, children }: LayoutRendererContext<TData>) => {
        const accordionConfig = layout as AccordionLayoutConfig;

        // Sort sections by order
        const sortedSections = useMemo(
            () => [...sections].sort((a, b) => a.order - b.order),
            [sections]
        );

        // Split children by sections (simplified implementation)
        const sectionChildren = useMemo(() => {
            const childrenArray = Array.isArray(children) ? children : [children];
            const sectionsMap = new Map<string, React.ReactNode[]>();

            sortedSections.forEach((section, index) => {
                sectionsMap.set(section.id, [childrenArray[index]]);
            });

            return sectionsMap;
        }, [children, sortedSections]);

        // Render accordion items
        const accordionItems = sortedSections.map((section) => (
            <AccordionItem
                key={section.id}
                value={section.id}
                className={cn(
                    accordionConfig.variant === 'ghost' && 'border-none',
                    accordionConfig.variant === 'separated' && 'rounded-lg border px-4'
                )}
            >
                <AccordionTrigger
                    className={cn(
                        'hover:no-underline',
                        accordionConfig.variant === 'ghost' && 'border-border border-b'
                    )}
                >
                    <div className="flex items-center gap-2">
                        {section.icon && (
                            <Icon
                                name={section.icon}
                                className="h-4 w-4"
                            />
                        )}
                        <span className="font-medium">{section.title}</span>
                        {section.badge && (
                            <span
                                className={cn(
                                    'ml-2 rounded-full px-2 py-1 text-xs',
                                    section.badge.variant === 'destructive' &&
                                        'bg-destructive text-destructive-foreground',
                                    section.badge.variant === 'secondary' &&
                                        'bg-secondary text-secondary-foreground',
                                    section.badge.variant === 'outline' && 'border border-border',
                                    !section.badge.variant && 'bg-primary text-primary-foreground'
                                )}
                            >
                                {section.badge.text}
                            </span>
                        )}
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                    <div className="space-y-4">
                        {section.description && (
                            <p className="text-muted-foreground text-sm">{section.description}</p>
                        )}
                        {section.helpText && (
                            <div className="rounded-md bg-muted p-3 text-muted-foreground text-sm">
                                {section.helpText}
                            </div>
                        )}
                        {sectionChildren.get(section.id)}
                    </div>
                </AccordionContent>
            </AccordionItem>
        ));

        // Render different accordion types
        if (accordionConfig.allowMultiple) {
            return (
                <Accordion
                    type="multiple"
                    defaultValue={
                        accordionConfig.defaultExpanded
                            ? [...accordionConfig.defaultExpanded]
                            : undefined
                    }
                    className={cn(
                        'w-full space-y-2',
                        accordionConfig.variant === 'ghost' && 'space-y-0',
                        accordionConfig.variant === 'separated' && 'space-y-4'
                    )}
                    data-layout="accordion"
                >
                    {accordionItems}
                </Accordion>
            );
        }

        return (
            <Accordion
                type="single"
                defaultValue={sortedSections[0]?.id}
                className={cn(
                    'w-full space-y-2',
                    accordionConfig.variant === 'ghost' && 'space-y-0',
                    accordionConfig.variant === 'separated' && 'space-y-4'
                )}
                data-layout="accordion"
            >
                {accordionItems}
            </Accordion>
        );
    }
);

AccordionLayout.displayName = 'AccordionLayout';
