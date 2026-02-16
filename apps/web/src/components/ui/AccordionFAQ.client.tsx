import { ChevronDownIcon } from '@repo/icons';
import { useState } from 'react';
import type { JSX } from 'react';

/**
 * Props for the AccordionFAQ component
 */
export interface AccordionFAQProps {
    /** Array of FAQ items with question and answer */
    readonly items: ReadonlyArray<{
        readonly question: string;
        readonly answer: string;
    }>;
    /** If false (default), only one item can be open at a time */
    readonly allowMultiple?: boolean;
    /** Additional CSS classes to apply to the accordion container */
    readonly className?: string;
}

/**
 * AccordionFAQ component for displaying frequently asked questions.
 * Uses native <details>/<summary> HTML elements for progressive enhancement.
 * Supports single or multiple open items and includes proper ARIA attributes.
 *
 * @example
 * ```tsx
 * <AccordionFAQ
 *   items={[
 *     { question: 'What is your return policy?', answer: 'You can return items within 30 days.' },
 *     { question: 'Do you ship internationally?', answer: 'Yes, we ship worldwide.' }
 *   ]}
 *   allowMultiple={false}
 * />
 * ```
 *
 * @param props - Component props
 * @returns Rendered accordion FAQ component
 */
export function AccordionFAQ({
    items,
    allowMultiple = false,
    className = ''
}: AccordionFAQProps): JSX.Element {
    const [openItems, setOpenItems] = useState<Set<number>>(new Set());

    /**
     * Handle toggle of individual accordion item
     */
    const handleToggle = ({ itemIndex }: { itemIndex: number }): void => {
        setOpenItems((prev) => {
            const newOpenItems = new Set(prev);

            if (newOpenItems.has(itemIndex)) {
                // Close the item
                newOpenItems.delete(itemIndex);
            } else {
                // Open the item
                if (!allowMultiple) {
                    // If only one item can be open at a time, clear all others
                    newOpenItems.clear();
                }
                newOpenItems.add(itemIndex);
            }

            return newOpenItems;
        });
    };

    return (
        <section
            className={`space-y-2 ${className}`.trim()}
            aria-label="Frequently Asked Questions"
        >
            {items.map((item, index) => {
                const isOpen = openItems.has(index);
                const itemId = `accordion-item-${index}`;
                const contentId = `accordion-content-${index}`;

                return (
                    <details
                        key={itemId}
                        className="group rounded-lg border border-gray-200 transition-all duration-200 hover:border-gray-300"
                        open={isOpen}
                    >
                        <summary
                            className="flex w-full cursor-pointer select-none list-none items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            aria-expanded={isOpen ? 'true' : 'false'}
                            aria-controls={contentId}
                            onClick={(e) => {
                                e.preventDefault();
                                handleToggle({ itemIndex: index });
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleToggle({ itemIndex: index });
                                }
                            }}
                        >
                            <span className="pr-4 font-semibold text-gray-900">
                                {item.question}
                            </span>
                            <span
                                className={`flex-shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                            >
                                <ChevronDownIcon size="sm" />
                            </span>
                        </summary>
                        <section
                            id={contentId}
                            className="px-4 pt-1 pb-4 text-gray-600 leading-relaxed"
                            aria-labelledby={itemId}
                        >
                            {item.answer}
                        </section>
                    </details>
                );
            })}
        </section>
    );
}
