import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const inputPath = resolve(__dirname, '../../../src/components/ui/Input.astro');
const textareaPath = resolve(__dirname, '../../../src/components/ui/Textarea.astro');
const selectPath = resolve(__dirname, '../../../src/components/ui/Select.astro');

const inputContent = readFileSync(inputPath, 'utf8');
const textareaContent = readFileSync(textareaPath, 'utf8');
const selectContent = readFileSync(selectPath, 'utf8');

describe('Input.astro', () => {
    describe('Props', () => {
        it('should require name prop', () => {
            expect(inputContent).toContain('name: string');
        });

        it('should accept type prop with valid input types', () => {
            expect(inputContent).toContain(
                "type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number'"
            );
        });

        it('should accept label prop', () => {
            expect(inputContent).toContain('label?: string');
        });

        it('should accept placeholder prop', () => {
            expect(inputContent).toContain('placeholder?: string');
        });

        it('should accept value prop', () => {
            expect(inputContent).toContain('value?: string');
        });

        it('should accept error prop', () => {
            expect(inputContent).toContain('error?: string');
        });

        it('should accept required prop', () => {
            expect(inputContent).toContain('required?: boolean');
        });

        it('should accept disabled prop', () => {
            expect(inputContent).toContain('disabled?: boolean');
        });

        it('should accept id prop', () => {
            expect(inputContent).toContain('id?: string');
        });

        it('should accept class prop', () => {
            expect(inputContent).toContain('class?: string');
        });

        it('should default type to text', () => {
            expect(inputContent).toContain("type = 'text'");
        });

        it('should default required to false', () => {
            expect(inputContent).toContain('required = false');
        });

        it('should default disabled to false', () => {
            expect(inputContent).toContain('disabled = false');
        });
    });

    describe('HTML Elements', () => {
        it('should render input element', () => {
            expect(inputContent).toContain('<input');
        });

        it('should render label when provided', () => {
            expect(inputContent).toContain('<label');
            expect(inputContent).toContain('for={inputId}');
        });

        it('should render error message when provided', () => {
            expect(inputContent).toContain('role="alert"');
        });

        it('should wrap elements in a div', () => {
            expect(inputContent).toContain('<div class="w-full">');
        });
    });

    describe('Accessibility', () => {
        it('should link label to input with id', () => {
            expect(inputContent).toContain('id={inputId}');
            expect(inputContent).toContain('for={inputId}');
        });

        it('should set aria-invalid when error exists', () => {
            expect(inputContent).toContain('aria-invalid');
        });

        it('should set aria-describedby for error message', () => {
            expect(inputContent).toContain('aria-describedby={error ? errorId : undefined}');
        });

        it('should show required indicator with aria-label', () => {
            expect(inputContent).toContain('aria-label="required"');
        });

        it('should generate unique ids', () => {
            expect(inputContent).toContain('input-${name}');
        });
    });

    describe('Styling', () => {
        it('should have base styles', () => {
            expect(inputContent).toContain('w-full');
            expect(inputContent).toContain('rounded-md');
            expect(inputContent).toContain('border');
        });

        it('should have focus styles with primary color', () => {
            expect(inputContent).toContain('focus:ring-primary');
            expect(inputContent).toContain('focus:ring-2');
        });

        it('should have error state styles', () => {
            expect(inputContent).toContain('border-red-500');
            expect(inputContent).toContain('focus:ring-red-500');
        });

        it('should have disabled state styles', () => {
            expect(inputContent).toContain('disabled:opacity-50');
            expect(inputContent).toContain('disabled:cursor-not-allowed');
        });

        it('should use design tokens', () => {
            expect(inputContent).toContain('border-border');
            expect(inputContent).toContain('bg-surface');
            expect(inputContent).toContain('text-text');
        });
    });

    describe('Error State', () => {
        it('should render error message with proper styling', () => {
            expect(inputContent).toContain('text-red-500');
        });

        it('should link error to input', () => {
            expect(inputContent).toContain('id={errorId}');
        });

        it('should conditionally render error message', () => {
            expect(inputContent).toContain('{error && (');
        });
    });
});

describe('Textarea.astro', () => {
    describe('Props', () => {
        it('should require name prop', () => {
            expect(textareaContent).toContain('name: string');
        });

        it('should accept label prop', () => {
            expect(textareaContent).toContain('label?: string');
        });

        it('should accept placeholder prop', () => {
            expect(textareaContent).toContain('placeholder?: string');
        });

        it('should accept value prop', () => {
            expect(textareaContent).toContain('value?: string');
        });

        it('should accept error prop', () => {
            expect(textareaContent).toContain('error?: string');
        });

        it('should accept required prop', () => {
            expect(textareaContent).toContain('required?: boolean');
        });

        it('should accept disabled prop', () => {
            expect(textareaContent).toContain('disabled?: boolean');
        });

        it('should accept rows prop', () => {
            expect(textareaContent).toContain('rows?: number');
        });

        it('should accept id prop', () => {
            expect(textareaContent).toContain('id?: string');
        });

        it('should accept class prop', () => {
            expect(textareaContent).toContain('class?: string');
        });

        it('should default rows to 4', () => {
            expect(textareaContent).toContain('rows = 4');
        });

        it('should default required to false', () => {
            expect(textareaContent).toContain('required = false');
        });

        it('should default disabled to false', () => {
            expect(textareaContent).toContain('disabled = false');
        });
    });

    describe('HTML Elements', () => {
        it('should render textarea element', () => {
            expect(textareaContent).toContain('<textarea');
        });

        it('should render label when provided', () => {
            expect(textareaContent).toContain('<label');
            expect(textareaContent).toContain('for={textareaId}');
        });

        it('should render error message when provided', () => {
            expect(textareaContent).toContain('role="alert"');
        });

        it('should wrap elements in a div', () => {
            expect(textareaContent).toContain('<div class="w-full">');
        });
    });

    describe('Accessibility', () => {
        it('should link label to textarea with id', () => {
            expect(textareaContent).toContain('id={textareaId}');
            expect(textareaContent).toContain('for={textareaId}');
        });

        it('should set aria-invalid when error exists', () => {
            expect(textareaContent).toContain('aria-invalid');
        });

        it('should set aria-describedby for error message', () => {
            expect(textareaContent).toContain('aria-describedby={error ? errorId : undefined}');
        });

        it('should show required indicator with aria-label', () => {
            expect(textareaContent).toContain('aria-label="required"');
        });

        it('should generate unique ids', () => {
            expect(textareaContent).toContain('textarea-${name}');
        });
    });

    describe('Styling', () => {
        it('should have base styles', () => {
            expect(textareaContent).toContain('w-full');
            expect(textareaContent).toContain('rounded-md');
            expect(textareaContent).toContain('border');
        });

        it('should have focus styles with primary color', () => {
            expect(textareaContent).toContain('focus:ring-primary');
            expect(textareaContent).toContain('focus:ring-2');
        });

        it('should have error state styles', () => {
            expect(textareaContent).toContain('border-red-500');
            expect(textareaContent).toContain('focus:ring-red-500');
        });

        it('should have disabled state styles', () => {
            expect(textareaContent).toContain('disabled:opacity-50');
            expect(textareaContent).toContain('disabled:cursor-not-allowed');
        });

        it('should have resize-vertical class', () => {
            expect(textareaContent).toContain('resize-vertical');
        });

        it('should use design tokens', () => {
            expect(textareaContent).toContain('border-border');
            expect(textareaContent).toContain('bg-surface');
            expect(textareaContent).toContain('text-text');
        });
    });

    describe('Error State', () => {
        it('should render error message with proper styling', () => {
            expect(textareaContent).toContain('text-red-500');
        });

        it('should link error to textarea', () => {
            expect(textareaContent).toContain('id={errorId}');
        });

        it('should conditionally render error message', () => {
            expect(textareaContent).toContain('{error && (');
        });
    });
});

describe('Select.astro', () => {
    describe('Props', () => {
        it('should require name prop', () => {
            expect(selectContent).toContain('name: string');
        });

        it('should require options prop as array', () => {
            expect(selectContent).toContain('options: Array<{ value: string; label: string }>');
        });

        it('should accept label prop', () => {
            expect(selectContent).toContain('label?: string');
        });

        it('should accept value prop', () => {
            expect(selectContent).toContain('value?: string');
        });

        it('should accept error prop', () => {
            expect(selectContent).toContain('error?: string');
        });

        it('should accept required prop', () => {
            expect(selectContent).toContain('required?: boolean');
        });

        it('should accept disabled prop', () => {
            expect(selectContent).toContain('disabled?: boolean');
        });

        it('should accept id prop', () => {
            expect(selectContent).toContain('id?: string');
        });

        it('should accept class prop', () => {
            expect(selectContent).toContain('class?: string');
        });

        it('should default required to false', () => {
            expect(selectContent).toContain('required = false');
        });

        it('should default disabled to false', () => {
            expect(selectContent).toContain('disabled = false');
        });
    });

    describe('HTML Elements', () => {
        it('should render select element', () => {
            expect(selectContent).toContain('<select');
        });

        it('should render option elements from array', () => {
            expect(selectContent).toContain('<option');
            expect(selectContent).toContain('options.map');
        });

        it('should render label when provided', () => {
            expect(selectContent).toContain('<label');
            expect(selectContent).toContain('for={selectId}');
        });

        it('should render error message when provided', () => {
            expect(selectContent).toContain('role="alert"');
        });

        it('should wrap elements in a div', () => {
            expect(selectContent).toContain('<div class="w-full">');
        });
    });

    describe('Accessibility', () => {
        it('should link label to select with id', () => {
            expect(selectContent).toContain('id={selectId}');
            expect(selectContent).toContain('for={selectId}');
        });

        it('should set aria-invalid when error exists', () => {
            expect(selectContent).toContain('aria-invalid');
        });

        it('should set aria-describedby for error message', () => {
            expect(selectContent).toContain('aria-describedby={error ? errorId : undefined}');
        });

        it('should show required indicator with aria-label', () => {
            expect(selectContent).toContain('aria-label="required"');
        });

        it('should generate unique ids', () => {
            expect(selectContent).toContain('select-${name}');
        });
    });

    describe('Styling', () => {
        it('should have base styles', () => {
            expect(selectContent).toContain('w-full');
            expect(selectContent).toContain('rounded-md');
            expect(selectContent).toContain('border');
        });

        it('should have focus styles with primary color', () => {
            expect(selectContent).toContain('focus:ring-primary');
            expect(selectContent).toContain('focus:ring-2');
        });

        it('should have error state styles', () => {
            expect(selectContent).toContain('border-red-500');
            expect(selectContent).toContain('focus:ring-red-500');
        });

        it('should have disabled state styles', () => {
            expect(selectContent).toContain('disabled:opacity-50');
            expect(selectContent).toContain('disabled:cursor-not-allowed');
        });

        it('should remove default appearance', () => {
            expect(selectContent).toContain('appearance-none');
        });

        it('should use design tokens', () => {
            expect(selectContent).toContain('border-border');
            expect(selectContent).toContain('bg-surface');
            expect(selectContent).toContain('text-text');
        });
    });

    describe('Chevron Icon', () => {
        it('should have custom chevron icon', () => {
            expect(selectContent).toContain('chevronIcon');
        });

        it('should use SVG data URI for icon', () => {
            expect(selectContent).toContain('data:image/svg+xml');
        });

        it('should position icon on the right', () => {
            expect(selectContent).toContain('background-position: right');
        });
    });

    describe('Error State', () => {
        it('should render error message with proper styling', () => {
            expect(selectContent).toContain('text-red-500');
        });

        it('should link error to select', () => {
            expect(selectContent).toContain('id={errorId}');
        });

        it('should conditionally render error message', () => {
            expect(selectContent).toContain('{error && (');
        });
    });

    describe('Options', () => {
        it('should map options to option elements', () => {
            expect(selectContent).toContain('options.map((option)');
        });

        it('should set option value and label', () => {
            expect(selectContent).toContain('value={option.value}');
            expect(selectContent).toContain('{option.label}');
        });

        it('should set selected based on value prop', () => {
            expect(selectContent).toContain('selected={value === option.value}');
        });
    });
});
