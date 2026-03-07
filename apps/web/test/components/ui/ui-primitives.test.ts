/**
 * @file ui-primitives.test.ts
 * @description Source-level tests for low-level UI primitive components:
 * button.tsx, select.tsx, drawer.tsx, popover.tsx, calendar.tsx, ThemeToggle.astro.
 *
 * All are in src/components/ui/. Tests verify exports, structure, token usage,
 * accessibility, and shadcn-style conventions.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../../src');

function readComponent(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

// ──────────────────────────────────────────────────────────────────────────────
// button.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('button.tsx', () => {
    const src = readComponent('components/ui/button.tsx');

    describe('Exports', () => {
        it('should export Button as a named function', () => {
            expect(src).toContain('export { Button');
        });

        it('should export buttonVariants', () => {
            expect(src).toContain('export { Button, buttonVariants }');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('class-variance-authority', () => {
        it('should import cva from class-variance-authority', () => {
            expect(src).toContain('class-variance-authority');
            expect(src).toContain('cva');
        });

        it('should define buttonVariants using cva', () => {
            expect(src).toContain('const buttonVariants = cva');
        });
    });

    describe('Variants', () => {
        it('should have a default variant', () => {
            expect(src).toContain('default:');
        });

        it('should have a destructive variant', () => {
            expect(src).toContain('destructive:');
        });

        it('should have an outline variant', () => {
            expect(src).toContain('outline:');
        });

        it('should have a secondary variant', () => {
            expect(src).toContain('secondary:');
        });

        it('should have a ghost variant', () => {
            expect(src).toContain('ghost:');
        });

        it('should have a link variant', () => {
            expect(src).toContain('link:');
        });
    });

    describe('Sizes', () => {
        it('should have default size', () => {
            expect(src).toContain("default: 'h-9");
        });

        it('should have sm size', () => {
            expect(src).toContain("sm: 'h-8");
        });

        it('should have lg size', () => {
            expect(src).toContain("lg: 'h-10");
        });

        it('should have icon size', () => {
            expect(src).toContain("icon: 'size-9'");
        });
    });

    describe('asChild support', () => {
        it('should support asChild prop for Radix Slot pattern', () => {
            expect(src).toContain('asChild');
            expect(src).toContain('Slot');
        });
    });

    describe('cn() utility', () => {
        it('should import cn from @/lib/cn', () => {
            expect(src).toContain("from '@/lib/cn'");
        });

        it('should use cn() to merge classNames', () => {
            expect(src).toContain('cn(buttonVariants');
        });
    });

    describe('className prop support', () => {
        it('should accept a className parameter', () => {
            expect(src).toContain('className,');
        });
    });

    describe('Semantic tokens', () => {
        it('should use bg-primary for default variant', () => {
            expect(src).toContain('bg-primary');
        });

        it('should use text-primary-foreground for default variant', () => {
            expect(src).toContain('text-primary-foreground');
        });

        it('should use bg-destructive for destructive variant', () => {
            expect(src).toContain('bg-destructive');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// select.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('select.tsx', () => {
    const src = readComponent('components/ui/select.tsx');

    describe('Exports', () => {
        it('should export Select', () => {
            expect(src).toContain('export {');
            expect(src).toContain('Select,');
        });

        it('should export SelectTrigger', () => {
            expect(src).toContain('SelectTrigger,');
        });

        it('should export SelectContent', () => {
            expect(src).toContain('SelectContent,');
        });

        it('should export SelectItem', () => {
            expect(src).toContain('SelectItem,');
        });

        it('should export SelectValue', () => {
            // SelectValue is the last item in the export block - no trailing comma
            expect(src).toContain('SelectValue');
        });

        it('should export SelectGroup', () => {
            expect(src).toContain('SelectGroup,');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('Radix UI integration', () => {
        it('should import from @radix-ui/react-select', () => {
            expect(src).toContain('@radix-ui/react-select');
        });
    });

    describe('Icons', () => {
        it('should import ChevronDownIcon from @repo/icons', () => {
            expect(src).toContain('ChevronDownIcon');
            expect(src).toContain('@repo/icons');
        });

        it('should import CheckIcon from @repo/icons', () => {
            expect(src).toContain('CheckIcon');
        });

        it('should import ChevronUpIcon from @repo/icons', () => {
            expect(src).toContain('ChevronUpIcon');
        });
    });

    describe('cn() utility', () => {
        it('should import and use cn from @/lib/cn', () => {
            expect(src).toContain("from '@/lib/cn'");
        });
    });

    describe('className prop support', () => {
        it('SelectTrigger should accept className', () => {
            expect(src).toContain('function SelectTrigger(');
            expect(src).toContain('className,');
        });

        it('SelectContent should accept className', () => {
            expect(src).toContain('function SelectContent(');
        });
    });

    describe('chevronColor prop', () => {
        it('should support chevronColor prop in SelectTrigger', () => {
            expect(src).toContain('chevronColor');
        });
    });

    describe('data-slot attributes', () => {
        it('should set data-slot="select" on root', () => {
            expect(src).toContain('data-slot="select"');
        });

        it('should set data-slot="select-trigger" on trigger', () => {
            expect(src).toContain('data-slot="select-trigger"');
        });

        it('should set data-slot="select-content" on content', () => {
            expect(src).toContain('data-slot="select-content"');
        });

        it('should set data-slot="select-item" on item', () => {
            expect(src).toContain('data-slot="select-item"');
        });
    });

    describe('Semantic tokens', () => {
        it('should use bg-popover for dropdown background', () => {
            expect(src).toContain('bg-popover');
        });

        it('should use focus:bg-accent for item focus state', () => {
            expect(src).toContain('focus:bg-accent');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// drawer.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('drawer.tsx', () => {
    const src = readComponent('components/ui/drawer.tsx');

    describe('Exports', () => {
        it('should export Drawer', () => {
            expect(src).toContain('Drawer,');
        });

        it('should export DrawerContent', () => {
            expect(src).toContain('DrawerContent');
        });

        it('should export DrawerHeader', () => {
            expect(src).toContain('DrawerHeader');
        });

        it('should export DrawerFooter', () => {
            expect(src).toContain('DrawerFooter');
        });

        it('should export DrawerTitle', () => {
            expect(src).toContain('DrawerTitle');
        });

        it('should export DrawerTrigger', () => {
            expect(src).toContain('DrawerTrigger');
        });

        it('should export DrawerClose', () => {
            expect(src).toContain('DrawerClose');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('Vaul integration', () => {
        it('should import Drawer from vaul', () => {
            expect(src).toContain("from 'vaul'");
        });

        it('should use DrawerPrimitive.Root for root element', () => {
            expect(src).toContain('DrawerPrimitive.Root');
        });
    });

    describe('cn() utility', () => {
        it('should import cn from @/lib/cn', () => {
            expect(src).toContain("from '@/lib/cn'");
        });
    });

    describe('className prop support', () => {
        it('DrawerOverlay should accept className', () => {
            expect(src).toContain('function DrawerOverlay(');
            expect(src).toContain('className,');
        });

        it('DrawerContent should accept className', () => {
            expect(src).toContain('function DrawerContent(');
        });
    });

    describe('data-slot attributes', () => {
        it('should set data-slot="drawer" on root', () => {
            expect(src).toContain('data-slot="drawer"');
        });

        it('should set data-slot="drawer-content" on content', () => {
            expect(src).toContain('data-slot="drawer-content"');
        });

        it('should set data-slot="drawer-header" on header', () => {
            expect(src).toContain('data-slot="drawer-header"');
        });

        it('should set data-slot="drawer-footer" on footer', () => {
            expect(src).toContain('data-slot="drawer-footer"');
        });
    });

    describe('Semantic tokens', () => {
        it('should use bg-background for drawer surface', () => {
            expect(src).toContain('bg-background');
        });

        it('should use bg-overlay for the backdrop overlay', () => {
            expect(src).toContain('bg-overlay');
        });

        it('should use bg-muted for the drag handle indicator', () => {
            expect(src).toContain('bg-muted');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// popover.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('popover.tsx', () => {
    const src = readComponent('components/ui/popover.tsx');

    describe('Exports', () => {
        it('should export Popover', () => {
            expect(src).toContain('Popover,');
        });

        it('should export PopoverTrigger', () => {
            expect(src).toContain('PopoverTrigger,');
        });

        it('should export PopoverContent', () => {
            // Inline single-line export: no trailing comma on last item
            expect(src).toContain('PopoverContent');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('Radix UI integration', () => {
        it('should import from @radix-ui/react-popover', () => {
            expect(src).toContain('@radix-ui/react-popover');
        });

        it('should use PopoverPrimitive.Root', () => {
            expect(src).toContain('PopoverPrimitive.Root');
        });

        it('should use PopoverPrimitive.Portal for portaling', () => {
            expect(src).toContain('PopoverPrimitive.Portal');
        });
    });

    describe('cn() utility', () => {
        it('should import cn from @/lib/cn', () => {
            expect(src).toContain("from '@/lib/cn'");
        });
    });

    describe('className prop support', () => {
        it('PopoverContent should accept className', () => {
            expect(src).toContain('function PopoverContent(');
            expect(src).toContain('className,');
        });
    });

    describe('Default props', () => {
        it('should default align to center', () => {
            expect(src).toContain("align = 'center'");
        });

        it('should default sideOffset to 4', () => {
            expect(src).toContain('sideOffset = 4');
        });
    });

    describe('data-slot attributes', () => {
        it('should set data-slot="popover" on root', () => {
            expect(src).toContain('data-slot="popover"');
        });

        it('should set data-slot="popover-trigger" on trigger', () => {
            expect(src).toContain('data-slot="popover-trigger"');
        });

        it('should set data-slot="popover-content" on content', () => {
            expect(src).toContain('data-slot="popover-content"');
        });
    });

    describe('Semantic tokens', () => {
        it('should use bg-popover for content background', () => {
            expect(src).toContain('bg-popover');
        });

        it('should use text-popover-foreground for content text', () => {
            expect(src).toContain('text-popover-foreground');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// calendar.tsx
// ──────────────────────────────────────────────────────────────────────────────

describe('calendar.tsx', () => {
    const src = readComponent('components/ui/calendar.tsx');

    describe('Exports', () => {
        it('should export Calendar as named function', () => {
            expect(src).toContain('export { Calendar');
        });

        it('should export CalendarDayButton', () => {
            expect(src).toContain('CalendarDayButton');
        });

        it('should NOT use a default export', () => {
            expect(src).not.toMatch(/^export default/m);
        });
    });

    describe('react-day-picker integration', () => {
        it('should import DayPicker from react-day-picker', () => {
            expect(src).toContain('react-day-picker');
            expect(src).toContain('DayPicker');
        });

        it('should import getDefaultClassNames', () => {
            expect(src).toContain('getDefaultClassNames');
        });
    });

    describe('Button integration', () => {
        it('should import Button from @/components/ui/button', () => {
            expect(src).toContain("from '@/components/ui/button'");
        });

        it('should support buttonVariant prop', () => {
            expect(src).toContain('buttonVariant');
        });
    });

    describe('Icons', () => {
        it('should import ChevronLeftIcon from @repo/icons', () => {
            expect(src).toContain('ChevronLeftIcon');
        });

        it('should import ChevronRightIcon from @repo/icons', () => {
            expect(src).toContain('ChevronRightIcon');
        });

        it('should import ChevronDownIcon from @repo/icons', () => {
            expect(src).toContain('ChevronDownIcon');
        });
    });

    describe('cn() utility', () => {
        it('should import cn from @/lib/cn', () => {
            expect(src).toContain("from '@/lib/cn'");
        });
    });

    describe('className prop support', () => {
        it('Calendar should accept className', () => {
            expect(src).toContain('className,');
        });
    });

    describe('data-slot attribute', () => {
        it('should set data-slot="calendar" on root', () => {
            expect(src).toContain('data-slot="calendar"');
        });
    });

    describe('Semantic tokens', () => {
        it('should use bg-background for calendar background', () => {
            expect(src).toContain('bg-background');
        });

        it('should use bg-accent for today and range highlighting', () => {
            expect(src).toContain('bg-accent');
        });

        it('should use bg-primary for range start/end', () => {
            expect(src).toContain('bg-primary');
        });

        it('should use text-muted-foreground for outside days and weekdays', () => {
            expect(src).toContain('text-muted-foreground');
        });
    });

    describe('showOutsideDays default', () => {
        it('should default showOutsideDays to true', () => {
            expect(src).toContain('showOutsideDays = true');
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// ThemeToggle.astro
// ──────────────────────────────────────────────────────────────────────────────

describe('ThemeToggle.astro', () => {
    const src = readComponent('components/ui/ThemeToggle.astro');

    describe('Button element', () => {
        it('should render a button element with id=theme-toggle', () => {
            expect(src).toContain('id="theme-toggle"');
        });

        it('should have type=button to prevent form submission', () => {
            expect(src).toContain('type="button"');
        });

        it('should have aria-label for accessibility', () => {
            expect(src).toContain('aria-label="Toggle dark mode"');
        });

        it('should have a title attribute', () => {
            expect(src).toContain('title="Toggle dark mode"');
        });
    });

    describe('Icons', () => {
        it('should have a sun SVG icon for dark mode (shown when dark)', () => {
            expect(src).toContain('theme-toggle__sun');
        });

        it('should have a moon SVG icon for light mode (shown when light)', () => {
            expect(src).toContain('theme-toggle__moon');
        });

        it('should mark SVG icons as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });
    });

    describe('localStorage integration', () => {
        it('should read from localStorage for initial state', () => {
            expect(src).toContain('localStorage');
        });

        it('should persist theme choice to localStorage', () => {
            expect(src).toContain('localStorage.setItem');
        });

        it('should use "theme" as the storage key', () => {
            expect(src).toContain('"theme"');
        });
    });

    describe('data-theme attribute', () => {
        it('should set data-theme="dark" when switching to dark mode', () => {
            expect(src).toContain('data-theme');
        });

        it('should read data-theme from documentElement to detect current theme', () => {
            expect(src).toContain('getAttribute("data-theme")');
        });

        it('should setAttribute for dark mode', () => {
            expect(src).toContain('setAttribute');
        });

        it('should removeAttribute to unset dark mode (light mode)', () => {
            expect(src).toContain('removeAttribute');
        });
    });

    describe('Script structure', () => {
        it('should contain an inline <script> block', () => {
            expect(src).toContain('<script>');
        });

        it('should define syncIcon function', () => {
            expect(src).toContain('function syncIcon');
        });

        it('should define applyTheme function', () => {
            expect(src).toContain('function applyTheme');
        });

        it('should define initToggle function', () => {
            expect(src).toContain('function initToggle');
        });

        it('should listen to astro:page-load for view transitions support', () => {
            expect(src).toContain('astro:page-load');
        });
    });

    describe('CSS classes', () => {
        it('should use focus-visible ring for keyboard accessibility', () => {
            expect(src).toContain('focus-visible:ring-2');
        });
    });
});
