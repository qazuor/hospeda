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
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <title>Toggle icon</title>
                                    <path
                                        fillRule="evenodd"
                                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                    />
                                </svg>
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
