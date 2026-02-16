import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const checkboxPath = resolve(__dirname, '../../../src/components/ui/Checkbox.astro');
const radioPath = resolve(__dirname, '../../../src/components/ui/Radio.astro');
const labelPath = resolve(__dirname, '../../../src/components/ui/Label.astro');
const formErrorPath = resolve(__dirname, '../../../src/components/ui/FormError.astro');

const checkboxContent = readFileSync(checkboxPath, 'utf8');
const radioContent = readFileSync(radioPath, 'utf8');
const labelContent = readFileSync(labelPath, 'utf8');
const formErrorContent = readFileSync(formErrorPath, 'utf8');

describe('Checkbox.astro', () => {
    describe('Props', () => {
        it('should require name prop', () => {
            expect(checkboxContent).toContain('name: string');
        });

        it('should require label prop', () => {
            expect(checkboxContent).toContain('label: string');
        });

        it('should accept checked prop', () => {
            expect(checkboxContent).toContain('checked?: boolean');
        });

        it('should accept value prop', () => {
            expect(checkboxContent).toContain('value?: string');
        });

        it('should accept disabled prop', () => {
            expect(checkboxContent).toContain('disabled?: boolean');
        });

        it('should accept id prop', () => {
            expect(checkboxContent).toContain('id?: string');
        });

        it('should accept class prop', () => {
            expect(checkboxContent).toContain('class?: string');
        });

        it('should default checked to false', () => {
            expect(checkboxContent).toContain('checked = false');
        });

        it('should default disabled to false', () => {
            expect(checkboxContent).toContain('disabled = false');
        });
    });

    describe('Structure', () => {
        it('should render checkbox input', () => {
            expect(checkboxContent).toContain('type="checkbox"');
        });

        it('should render label element', () => {
            expect(checkboxContent).toContain('<label');
        });

        it('should bind label to input with for attribute', () => {
            expect(checkboxContent).toContain('for={checkboxId}');
            expect(checkboxContent).toContain('id={checkboxId}');
        });

        it('should wrap in div container', () => {
            expect(checkboxContent).toContain('<div');
        });
    });

    describe('Accessibility', () => {
        it('should generate unique id when not provided', () => {
            expect(checkboxContent).toContain('checkboxId');
            expect(checkboxContent).toContain('Math.random()');
        });

        it('should link label to input', () => {
            expect(checkboxContent).toContain('for={checkboxId}');
        });
    });

    describe('Styling', () => {
        it('should use primary accent color', () => {
            expect(checkboxContent).toContain('text-primary');
        });

        it('should have focus ring', () => {
            expect(checkboxContent).toContain('focus:ring-2');
            expect(checkboxContent).toContain('focus:ring-primary');
        });

        it('should have disabled styles', () => {
            expect(checkboxContent).toContain('disabled:cursor-not-allowed');
            expect(checkboxContent).toContain('disabled:opacity-50');
        });

        it('should use inline-flex layout', () => {
            expect(checkboxContent).toContain('inline-flex');
        });
    });
});

describe('Radio.astro', () => {
    describe('Props', () => {
        it('should require name prop', () => {
            expect(radioContent).toContain('name: string');
        });

        it('should require label prop', () => {
            expect(radioContent).toContain('label: string');
        });

        it('should require value prop', () => {
            expect(radioContent).toContain('value: string');
        });

        it('should accept checked prop', () => {
            expect(radioContent).toContain('checked?: boolean');
        });

        it('should accept disabled prop', () => {
            expect(radioContent).toContain('disabled?: boolean');
        });

        it('should accept id prop', () => {
            expect(radioContent).toContain('id?: string');
        });

        it('should accept class prop', () => {
            expect(radioContent).toContain('class?: string');
        });

        it('should default checked to false', () => {
            expect(radioContent).toContain('checked = false');
        });

        it('should default disabled to false', () => {
            expect(radioContent).toContain('disabled = false');
        });
    });

    describe('Structure', () => {
        it('should render radio input', () => {
            expect(radioContent).toContain('type="radio"');
        });

        it('should render label element', () => {
            expect(radioContent).toContain('<label');
        });

        it('should bind label to input with for attribute', () => {
            expect(radioContent).toContain('for={radioId}');
            expect(radioContent).toContain('id={radioId}');
        });

        it('should wrap in div container', () => {
            expect(radioContent).toContain('<div');
        });
    });

    describe('Accessibility', () => {
        it('should generate unique id when not provided', () => {
            expect(radioContent).toContain('radioId');
            expect(radioContent).toContain('Math.random()');
        });

        it('should link label to input', () => {
            expect(radioContent).toContain('for={radioId}');
        });
    });

    describe('Styling', () => {
        it('should use primary accent color', () => {
            expect(radioContent).toContain('text-primary');
        });

        it('should have focus ring', () => {
            expect(radioContent).toContain('focus:ring-2');
            expect(radioContent).toContain('focus:ring-primary');
        });

        it('should have disabled styles', () => {
            expect(radioContent).toContain('disabled:cursor-not-allowed');
            expect(radioContent).toContain('disabled:opacity-50');
        });

        it('should use inline-flex layout', () => {
            expect(radioContent).toContain('inline-flex');
        });
    });
});

describe('Label.astro', () => {
    describe('Props', () => {
        it('should accept for prop', () => {
            expect(labelContent).toContain('for?: string');
        });

        it('should accept required prop', () => {
            expect(labelContent).toContain('required?: boolean');
        });

        it('should accept class prop', () => {
            expect(labelContent).toContain('class?: string');
        });

        it('should default required to false', () => {
            expect(labelContent).toContain('required = false');
        });
    });

    describe('Structure', () => {
        it('should render label element', () => {
            expect(labelContent).toContain('<label');
        });

        it('should use slot for content', () => {
            expect(labelContent).toContain('<slot />');
        });

        it('should bind for attribute', () => {
            expect(labelContent).toContain('for={htmlFor}');
        });
    });

    describe('Required indicator', () => {
        it('should show asterisk when required', () => {
            expect(labelContent).toContain('{required &&');
            expect(labelContent).toContain('*');
        });

        it('should use red color for asterisk', () => {
            expect(labelContent).toContain('text-red-500');
        });

        it('should have aria-label for asterisk', () => {
            expect(labelContent).toContain('aria-label="required"');
        });
    });

    describe('Styling', () => {
        it('should use font-medium', () => {
            expect(labelContent).toContain('font-medium');
        });

        it('should use text-text color', () => {
            expect(labelContent).toContain('text-text');
        });

        it('should use small text size', () => {
            expect(labelContent).toContain('text-sm');
        });
    });
});

describe('FormError.astro', () => {
    describe('Props', () => {
        it('should accept message prop', () => {
            expect(formErrorContent).toContain('message?: string');
        });

        it('should accept id prop', () => {
            expect(formErrorContent).toContain('id?: string');
        });

        it('should accept class prop', () => {
            expect(formErrorContent).toContain('class?: string');
        });
    });

    describe('Conditional rendering', () => {
        it('should only render when message is truthy', () => {
            expect(formErrorContent).toContain('{message &&');
        });

        it('should render message text', () => {
            expect(formErrorContent).toContain('{message}');
        });
    });

    describe('Accessibility', () => {
        it('should have role="alert"', () => {
            expect(formErrorContent).toContain('role="alert"');
        });

        it('should have aria-live="polite"', () => {
            expect(formErrorContent).toContain('aria-live="polite"');
        });
    });

    describe('Styling', () => {
        it('should use red text color', () => {
            expect(formErrorContent).toContain('text-red-500');
        });

        it('should use small text size', () => {
            expect(formErrorContent).toContain('text-sm');
        });
    });

    describe('Structure', () => {
        it('should render as paragraph', () => {
            expect(formErrorContent).toContain('<p');
        });

        it('should bind id attribute', () => {
            expect(formErrorContent).toContain('id={id}');
        });
    });
});
