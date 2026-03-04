import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    AccordionFAQ,
    type AccordionFAQProps
} from '../../../src/components/ui/AccordionFAQ.client';

const mockItems: AccordionFAQProps['items'] = [
    {
        question: 'What is your return policy?',
        answer: 'You can return items within 30 days of purchase.'
    },
    {
        question: 'Do you ship internationally?',
        answer: 'Yes, we ship to most countries worldwide.'
    },
    {
        question: 'How long does shipping take?',
        answer: 'Standard shipping takes 5-7 business days.'
    }
];

describe('AccordionFAQ.client.tsx', () => {
    describe('Props', () => {
        it('should accept items prop', () => {
            render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            for (const item of mockItems) {
                expect(screen.getByText(item.question)).toBeInTheDocument();
            }
        });

        it('should accept allowMultiple prop', () => {
            const { rerender } = render(
                <AccordionFAQ
                    items={mockItems}
                    allowMultiple={false}
                    locale="en"
                />
            );
            expect(screen.getByText(mockItems[0]!.question)).toBeInTheDocument();

            rerender(
                <AccordionFAQ
                    items={mockItems}
                    allowMultiple={true}
                    locale="en"
                />
            );
            expect(screen.getByText(mockItems[0]!.question)).toBeInTheDocument();
        });

        it('should default allowMultiple to false', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const summaries = container.querySelectorAll('summary');
            const firstSummary = summaries[0]!;
            const secondSummary = summaries[1]!;

            fireEvent.click(firstSummary);
            fireEvent.click(secondSummary);

            // Only second should be open (first should be closed)
            expect(firstSummary).toHaveAttribute('aria-expanded', 'false');
            expect(secondSummary).toHaveAttribute('aria-expanded', 'true');
        });

        it('should accept className prop', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    className="custom-class"
                    locale="en"
                />
            );
            const accordion = container.querySelector('section[aria-label]');
            expect(accordion).toHaveClass('custom-class');
        });
    });

    describe('Rendering', () => {
        it('should render all items', () => {
            render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            for (const item of mockItems) {
                expect(screen.getByText(item.question)).toBeInTheDocument();
            }
        });

        it('should render all items in details elements', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const detailsElements = container.querySelectorAll('details');
            expect(detailsElements).toHaveLength(mockItems.length);
        });

        it('should render questions in summary elements', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const summaries = container.querySelectorAll('summary');
            expect(summaries).toHaveLength(mockItems.length);
            for (let i = 0; i < mockItems.length; i++) {
                expect(summaries[i]).toHaveTextContent(mockItems[i]!.question);
            }
        });

        it('should render toggle icons in summary elements', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const icons = container.querySelectorAll('summary svg');
            expect(icons).toHaveLength(mockItems.length);
        });

        it('should have section element as container', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const section = container.querySelector('section[aria-label]');
            expect(section).toBeInTheDocument();
        });
    });

    describe('Expand/Collapse Behavior', () => {
        it('should start with all items closed', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const detailsElements = container.querySelectorAll('details');
            for (const details of Array.from(detailsElements)) {
                expect(details).not.toHaveAttribute('open');
            }
        });

        it('should expand item when clicked', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const firstSummary = container.querySelector('summary')!;

            fireEvent.click(firstSummary);

            expect(firstSummary).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByText(mockItems[0]!.answer)).toBeInTheDocument();
        });

        it('should collapse item when clicked again', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const firstSummary = container.querySelector('summary')!;

            fireEvent.click(firstSummary);
            expect(firstSummary).toHaveAttribute('aria-expanded', 'true');

            fireEvent.click(firstSummary);
            expect(firstSummary).toHaveAttribute('aria-expanded', 'false');
        });
    });

    describe('Single Open Behavior (allowMultiple=false)', () => {
        it('should close other items when opening a new one', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    allowMultiple={false}
                    locale="en"
                />
            );
            const summaries = Array.from(container.querySelectorAll('summary'));
            const firstSummary = summaries[0]!;
            const secondSummary = summaries[1]!;

            fireEvent.click(firstSummary);
            expect(firstSummary).toHaveAttribute('aria-expanded', 'true');

            fireEvent.click(secondSummary);
            expect(firstSummary).toHaveAttribute('aria-expanded', 'false');
            expect(secondSummary).toHaveAttribute('aria-expanded', 'true');
        });

        it('should only keep one item open at a time', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    allowMultiple={false}
                    locale="en"
                />
            );
            const summaries = Array.from(container.querySelectorAll('summary'));

            // Open first item
            fireEvent.click(summaries[0]!);
            expect(summaries[0]).toHaveAttribute('aria-expanded', 'true');

            // Open second item (should close first)
            fireEvent.click(summaries[1]!);
            expect(summaries[0]).toHaveAttribute('aria-expanded', 'false');
            expect(summaries[1]).toHaveAttribute('aria-expanded', 'true');

            // Open third item (should close second)
            fireEvent.click(summaries[2]!);
            expect(summaries[0]).toHaveAttribute('aria-expanded', 'false');
            expect(summaries[1]).toHaveAttribute('aria-expanded', 'false');
            expect(summaries[2]).toHaveAttribute('aria-expanded', 'true');
        });
    });

    describe('Multiple Open Behavior (allowMultiple=true)', () => {
        it('should allow multiple items to be open simultaneously', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    allowMultiple={true}
                    locale="en"
                />
            );
            const summaries = Array.from(container.querySelectorAll('summary'));
            const firstSummary = summaries[0]!;
            const secondSummary = summaries[1]!;

            fireEvent.click(firstSummary);
            fireEvent.click(secondSummary);

            expect(firstSummary).toHaveAttribute('aria-expanded', 'true');
            expect(secondSummary).toHaveAttribute('aria-expanded', 'true');
        });

        it('should allow all items to be open', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    allowMultiple={true}
                    locale="en"
                />
            );
            const summaries = Array.from(container.querySelectorAll('summary'));

            for (const summary of summaries) {
                fireEvent.click(summary);
            }

            for (const summary of summaries) {
                expect(summary).toHaveAttribute('aria-expanded', 'true');
            }
        });

        it('should allow individual items to be closed independently', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    allowMultiple={true}
                    locale="en"
                />
            );
            const summaries = Array.from(container.querySelectorAll('summary'));

            // Open all items
            for (const summary of summaries) {
                fireEvent.click(summary);
            }

            // Close second item
            fireEvent.click(summaries[1]!);

            expect(summaries[0]).toHaveAttribute('aria-expanded', 'true');
            expect(summaries[1]).toHaveAttribute('aria-expanded', 'false');
            expect(summaries[2]).toHaveAttribute('aria-expanded', 'true');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on container', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const region = container.querySelector('section[aria-label]');
            expect(region).toHaveAttribute('aria-label', 'Frequently Asked Questions');
        });

        it('should have aria-expanded on summary elements', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const summaries = container.querySelectorAll('summary');
            for (const summary of Array.from(summaries)) {
                expect(summary).toHaveAttribute('aria-expanded');
            }
        });

        it('should have aria-expanded="false" on closed items', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const firstSummary = container.querySelector('summary')!;
            expect(firstSummary).toHaveAttribute('aria-expanded', 'false');
        });

        it('should have aria-expanded="true" on open items', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const firstSummary = container.querySelector('summary')!;

            fireEvent.click(firstSummary);

            expect(firstSummary).toHaveAttribute('aria-expanded', 'true');
        });

        it('should have aria-controls on summary elements', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const summaries = container.querySelectorAll('summary');
            for (const summary of Array.from(summaries)) {
                expect(summary).toHaveAttribute('aria-controls');
            }
        });

        it('should have unique IDs for aria-controls', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const summaries = container.querySelectorAll('summary');
            const controls = Array.from(summaries).map((s) => s.getAttribute('aria-controls'));

            const uniqueControls = new Set(controls);
            expect(uniqueControls.size).toBe(controls.length);
        });

        it('should have matching ID on content div', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const firstSummary = container.querySelector('summary');
            const controlsId = firstSummary?.getAttribute('aria-controls');
            const contentDiv = container.querySelector(`#${controlsId}`);

            expect(contentDiv).toBeInTheDocument();
        });

        it('should have aria-hidden on toggle icon', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const icons = container.querySelectorAll('summary svg');
            for (const icon of Array.from(icons)) {
                const parent = icon.parentElement;
                expect(parent).toHaveAttribute('aria-hidden', 'true');
            }
        });

        it('should have focus-visible styles on summary', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const firstSummary = container.querySelector('summary');
            expect(firstSummary?.className).toContain('focus-visible:outline');
        });

        it('should have section element for content', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const contentSections = container.querySelectorAll('details > section');
            for (const section of Array.from(contentSections)) {
                expect(section).toHaveAttribute('aria-labelledby');
            }
        });
    });

    describe('Content Display', () => {
        it('should display answer when item is expanded', () => {
            render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const firstSummary = screen.getByText(mockItems[0]!.question);

            fireEvent.click(firstSummary);

            expect(screen.getByText(mockItems[0]!.answer)).toBeInTheDocument();
        });

        it('should display correct answer for each item', () => {
            render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );

            for (let i = 0; i < mockItems.length; i++) {
                const summary = screen.getByText(mockItems[i]!.question);
                fireEvent.click(summary);
                expect(screen.getByText(mockItems[i]!.answer)).toBeInTheDocument();
                fireEvent.click(summary); // Close it
            }
        });
    });

    describe('Styling', () => {
        it('should have border on details elements', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const detailsElements = container.querySelectorAll('details');
            for (const details of Array.from(detailsElements)) {
                expect(details.className).toContain('border');
            }
        });

        it('should have rounded corners on details elements', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const detailsElements = container.querySelectorAll('details');
            for (const details of Array.from(detailsElements)) {
                expect(details.className).toContain('rounded-lg');
            }
        });

        it('should have hover styles on details elements', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const detailsElements = container.querySelectorAll('details');
            for (const details of Array.from(detailsElements)) {
                expect(details.className).toContain('hover:border-border');
            }
        });

        it('should have hover styles on summary elements', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const summaries = container.querySelectorAll('summary');
            for (const summary of Array.from(summaries)) {
                expect(summary.className).toContain('hover:bg-surface-alt');
            }
        });

        it('should have transition styles on details elements', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const detailsElements = container.querySelectorAll('details');
            for (const details of Array.from(detailsElements)) {
                expect(details.className).toContain('transition-all');
            }
        });

        it('should have transition styles on toggle icon', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const iconContainers = container.querySelectorAll('summary > span:last-child');
            for (const iconContainer of Array.from(iconContainers)) {
                expect(iconContainer.className).toContain('transition-transform');
            }
        });

        it('should have spacing between items', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    locale="en"
                />
            );
            const accordion = container.querySelector('section[aria-label]');
            expect(accordion?.className).toContain('space-y-2');
        });
    });

    describe('className Prop', () => {
        it('should forward className to container', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    className="my-custom-class"
                    locale="en"
                />
            );
            const accordion = container.querySelector('section[aria-label]');
            expect(accordion).toHaveClass('my-custom-class');
        });

        it('should preserve base classes when className is added', () => {
            const { container } = render(
                <AccordionFAQ
                    items={mockItems}
                    className="my-custom-class"
                    locale="en"
                />
            );
            const accordion = container.querySelector('section[aria-label]');
            expect(accordion).toHaveClass('space-y-2');
            expect(accordion).toHaveClass('my-custom-class');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty items array', () => {
            const { container } = render(
                <AccordionFAQ
                    items={[]}
                    locale="en"
                />
            );
            const details = container.querySelectorAll('details');
            expect(details).toHaveLength(0);
        });

        it('should handle single item', () => {
            const singleItem = [mockItems[0]!];
            render(
                <AccordionFAQ
                    items={singleItem}
                    locale="en"
                />
            );
            expect(screen.getByText(singleItem[0]!.question)).toBeInTheDocument();
        });

        it('should handle items with long text', () => {
            const longTextItems = [
                {
                    question:
                        'This is a very long question that might wrap to multiple lines in the UI and test how the component handles long text content',
                    answer: 'This is a very long answer with lots of text that should be displayed properly even when it spans multiple lines and contains a lot of information for the user to read.'
                }
            ];
            render(
                <AccordionFAQ
                    items={longTextItems}
                    locale="en"
                />
            );
            expect(screen.getByText(longTextItems[0]!.question)).toBeInTheDocument();
        });

        it('should handle items with special characters', () => {
            const specialItems = [
                {
                    question: 'What about <HTML> & "special" characters?',
                    answer: 'They should be rendered as text, not parsed.'
                }
            ];
            render(
                <AccordionFAQ
                    items={specialItems}
                    locale="en"
                />
            );
            expect(screen.getByText(specialItems[0]!.question)).toBeInTheDocument();
        });
    });
});
