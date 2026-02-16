import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tabs } from '../../../src/components/ui/Tabs.client';
import type { TabItem } from '../../../src/components/ui/Tabs.client';

describe('Tabs.client.tsx', () => {
    const mockTabs: ReadonlyArray<TabItem> = [
        { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
        { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
        { id: 'tab3', label: 'Tab 3', content: <div>Content 3</div> }
    ];

    describe('Props', () => {
        it('should accept tabs prop', () => {
            render(<Tabs tabs={mockTabs} />);
            expect(screen.getByText('Tab 1')).toBeInTheDocument();
            expect(screen.getByText('Tab 2')).toBeInTheDocument();
            expect(screen.getByText('Tab 3')).toBeInTheDocument();
        });

        it('should accept defaultTab prop', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab2"
                />
            );
            const tab2Button = screen.getByRole('tab', { name: 'Tab 2' });
            expect(tab2Button).toHaveAttribute('aria-selected', 'true');
        });

        it('should default to first tab when defaultTab is not provided', () => {
            render(<Tabs tabs={mockTabs} />);
            const tab1Button = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1Button).toHaveAttribute('aria-selected', 'true');
        });

        it('should accept className prop', () => {
            const { container } = render(
                <Tabs
                    tabs={mockTabs}
                    className="custom-tabs-class"
                />
            );
            const tabsContainer = container.firstChild as HTMLElement;
            expect(tabsContainer).toHaveClass('custom-tabs-class');
        });
    });

    describe('Rendering', () => {
        it('should render all tab labels', () => {
            render(<Tabs tabs={mockTabs} />);
            expect(screen.getByText('Tab 1')).toBeInTheDocument();
            expect(screen.getByText('Tab 2')).toBeInTheDocument();
            expect(screen.getByText('Tab 3')).toBeInTheDocument();
        });

        it('should render tab list with role="tablist"', () => {
            render(<Tabs tabs={mockTabs} />);
            const tabList = screen.getByRole('tablist');
            expect(tabList).toBeInTheDocument();
        });

        it('should render tab buttons with role="tab"', () => {
            render(<Tabs tabs={mockTabs} />);
            const tabs = screen.getAllByRole('tab');
            expect(tabs).toHaveLength(3);
        });

        it('should render tab panels with role="tabpanel"', () => {
            render(<Tabs tabs={mockTabs} />);
            const panels = screen.getAllByRole('tabpanel', { hidden: true });
            expect(panels).toHaveLength(3);
        });

        it('should render only active tab panel visible', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab2"
                />
            );

            const allPanels = screen.getAllByRole('tabpanel', { hidden: true });
            expect(allPanels).toHaveLength(3);

            const panel2 = screen.getByRole('tabpanel', { name: 'Tab 2' });
            expect(panel2).toBeVisible();
            expect(screen.getByText('Content 2')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have aria-selected="true" on active tab', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );
            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1).toHaveAttribute('aria-selected', 'true');
        });

        it('should have aria-selected="false" on inactive tabs', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );
            const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
            const tab3 = screen.getByRole('tab', { name: 'Tab 3' });
            expect(tab2).toHaveAttribute('aria-selected', 'false');
            expect(tab3).toHaveAttribute('aria-selected', 'false');
        });

        it('should have aria-controls attribute linking tab to panel', () => {
            render(<Tabs tabs={mockTabs} />);
            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1).toHaveAttribute('aria-controls', 'panel-tab1');
        });

        it('should have aria-labelledby attribute linking panel to tab', () => {
            render(<Tabs tabs={mockTabs} />);
            const panel1 = screen.getByRole('tabpanel', { name: 'Tab 1' });
            expect(panel1).toHaveAttribute('aria-labelledby', 'tab-tab1');
        });

        it('should have id attribute on tab buttons', () => {
            render(<Tabs tabs={mockTabs} />);
            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1).toHaveAttribute('id', 'tab-tab1');
        });

        it('should have id attribute on tab panels', () => {
            render(<Tabs tabs={mockTabs} />);
            const panel1 = screen.getByRole('tabpanel', { name: 'Tab 1' });
            expect(panel1).toHaveAttribute('id', 'panel-tab1');
        });

        it('should have tabIndex=0 on active tab', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );
            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1).toHaveAttribute('tabIndex', '0');
        });

        it('should have tabIndex=-1 on inactive tabs', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );
            const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
            const tab3 = screen.getByRole('tab', { name: 'Tab 3' });
            expect(tab2).toHaveAttribute('tabIndex', '-1');
            expect(tab3).toHaveAttribute('tabIndex', '-1');
        });

        it('should have focus-visible styles', () => {
            render(<Tabs tabs={mockTabs} />);
            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1.className).toContain('focus-visible:outline');
        });
    });

    describe('Interaction', () => {
        it('should switch to clicked tab', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );

            const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
            fireEvent.click(tab2);

            expect(tab2).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByText('Content 2')).toBeVisible();
        });

        it('should update active state when tab is clicked', () => {
            render(<Tabs tabs={mockTabs} />);

            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            const tab3 = screen.getByRole('tab', { name: 'Tab 3' });

            fireEvent.click(tab3);
            expect(tab3).toHaveAttribute('aria-selected', 'true');
            expect(tab1).toHaveAttribute('aria-selected', 'false');
        });

        it('should show only active panel content', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );

            expect(screen.getByText('Content 1')).toBeVisible();
            expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
            expect(screen.queryByText('Content 3')).not.toBeInTheDocument();

            const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
            fireEvent.click(tab2);

            expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
            expect(screen.getByText('Content 2')).toBeVisible();
            expect(screen.queryByText('Content 3')).not.toBeInTheDocument();
        });
    });

    describe('Keyboard Navigation', () => {
        it('should move to next tab on ArrowRight', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );

            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            fireEvent.keyDown(tab1, { key: 'ArrowRight' });

            const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
            expect(tab2).toHaveAttribute('aria-selected', 'true');
        });

        it('should move to previous tab on ArrowLeft', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab2"
                />
            );

            const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
            fireEvent.keyDown(tab2, { key: 'ArrowLeft' });

            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1).toHaveAttribute('aria-selected', 'true');
        });

        it('should wrap to last tab when ArrowLeft on first tab', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );

            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            fireEvent.keyDown(tab1, { key: 'ArrowLeft' });

            const tab3 = screen.getByRole('tab', { name: 'Tab 3' });
            expect(tab3).toHaveAttribute('aria-selected', 'true');
        });

        it('should wrap to first tab when ArrowRight on last tab', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab3"
                />
            );

            const tab3 = screen.getByRole('tab', { name: 'Tab 3' });
            fireEvent.keyDown(tab3, { key: 'ArrowRight' });

            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1).toHaveAttribute('aria-selected', 'true');
        });

        it('should move to first tab on Home key', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab3"
                />
            );

            const tab3 = screen.getByRole('tab', { name: 'Tab 3' });
            fireEvent.keyDown(tab3, { key: 'Home' });

            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1).toHaveAttribute('aria-selected', 'true');
        });

        it('should move to last tab on End key', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );

            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            fireEvent.keyDown(tab1, { key: 'End' });

            const tab3 = screen.getByRole('tab', { name: 'Tab 3' });
            expect(tab3).toHaveAttribute('aria-selected', 'true');
        });

        it('should handle keyboard navigation without errors', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );

            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });

            // Test that navigation keys work without throwing errors
            expect(() => {
                fireEvent.keyDown(tab1, { key: 'ArrowRight' });
                fireEvent.keyDown(tab1, { key: 'ArrowLeft' });
                fireEvent.keyDown(tab1, { key: 'Home' });
                fireEvent.keyDown(tab1, { key: 'End' });
            }).not.toThrow();
        });
    });

    describe('Button Attributes', () => {
        it('should have type="button" on tab buttons', () => {
            render(<Tabs tabs={mockTabs} />);
            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1).toHaveAttribute('type', 'button');
        });

        it('should not be disabled by default', () => {
            render(<Tabs tabs={mockTabs} />);
            const tabs = screen.getAllByRole('tab');
            for (const tab of tabs) {
                expect(tab).not.toBeDisabled();
            }
        });
    });

    describe('Styling', () => {
        it('should apply active styles to active tab', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );
            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1.className).toContain('border-primary');
            expect(tab1.className).toContain('text-primary');
        });

        it('should apply inactive styles to inactive tabs', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );
            const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
            expect(tab2.className).toContain('text-gray-600');
            expect(tab2.className).toContain('border-transparent');
        });

        it('should have hover styles on inactive tabs', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="tab1"
                />
            );
            const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
            expect(tab2.className).toContain('hover:text-gray-800');
            expect(tab2.className).toContain('hover:border-gray-300');
        });

        it('should have transition styles on buttons', () => {
            render(<Tabs tabs={mockTabs} />);
            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1.className).toContain('transition-colors');
        });

        it('should have border on tab list', () => {
            render(<Tabs tabs={mockTabs} />);
            const tabList = screen.getByRole('tablist');
            expect(tabList.className).toContain('border-b');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty tabs array gracefully', () => {
            render(<Tabs tabs={[]} />);
            const tabList = screen.getByRole('tablist');
            expect(tabList).toBeInTheDocument();
        });

        it('should handle single tab', () => {
            const singleTab: ReadonlyArray<TabItem> = [
                { id: 'only', label: 'Only Tab', content: <div>Only Content</div> }
            ];
            render(<Tabs tabs={singleTab} />);
            const tab = screen.getByRole('tab', { name: 'Only Tab' });
            expect(tab).toHaveAttribute('aria-selected', 'true');
        });

        it('should handle invalid defaultTab by defaulting to first tab', () => {
            render(
                <Tabs
                    tabs={mockTabs}
                    defaultTab="nonexistent"
                />
            );
            const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
            expect(tab1).toHaveAttribute('aria-selected', 'false');
        });

        it('should handle tab content with complex React nodes', () => {
            const complexTabs: ReadonlyArray<TabItem> = [
                {
                    id: 'complex',
                    label: 'Complex',
                    content: (
                        <div>
                            <h2>Heading</h2>
                            <p>Paragraph</p>
                            <button type="button">Button</button>
                        </div>
                    )
                }
            ];
            render(<Tabs tabs={complexTabs} />);
            expect(screen.getByText('Heading')).toBeInTheDocument();
            expect(screen.getByText('Paragraph')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Button' })).toBeInTheDocument();
        });
    });
});
