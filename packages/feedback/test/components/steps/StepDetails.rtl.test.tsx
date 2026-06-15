import type { FeedbackEnvironment } from '@repo/schemas';
/**
 * RTL-based tests for StepDetails component.
 *
 * Covers the uncovered branches in StepDetails.tsx: field onChange handlers,
 * collapsible tech details section, attachment file validation (size + type),
 * environment field changes, updateErrorInfo helper, drag-and-drop, and the
 * "clear interactions" button.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepDetails, type StepDetailsData } from '../../../src/components/steps/StepDetails.js';
import { FEEDBACK_CONFIG, SEVERITY_LEVELS } from '../../../src/config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../../../src/config/strings.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeEnvironment = (overrides: Partial<FeedbackEnvironment> = {}): FeedbackEnvironment => ({
    timestamp: new Date().toISOString(),
    appSource: 'admin',
    ...overrides
});

const makeData = (overrides: Partial<StepDetailsData> = {}): StepDetailsData => ({
    severity: undefined,
    stepsToReproduce: undefined,
    expectedResult: undefined,
    actualResult: undefined,
    ...overrides
});

const makeProps = (overrides: Partial<Parameters<typeof StepDetails>[0]> = {}) => ({
    data: makeData(),
    onChange: vi.fn(),
    attachments: [],
    onAddAttachments: vi.fn(),
    onRemoveAttachment: vi.fn(),
    environment: makeEnvironment(),
    onEnvironmentChange: vi.fn(),
    onBack: vi.fn(),
    onSubmit: vi.fn(),
    isSubmitting: false,
    ...overrides
});

/**
 * Opens the tech details section by clicking the toggle button.
 * The button contains a text span + a chevron span, so we find it via
 * the text of the inner span (FEEDBACK_STRINGS.techDetails.title).
 */
function openTechDetails() {
    // Find the button that CONTAINS the tech details title text.
    // We use getByText to find the span inside the button, then click its parent button.
    const titleSpan = screen.getByText(FEEDBACK_STRINGS.techDetails.title);
    const toggle = titleSpan.closest('button') as HTMLElement;
    fireEvent.click(toggle);
}

/** Returns the upload zone label element (the drag-and-drop area). */
function getUploadZone(): HTMLLabelElement {
    return screen
        .getByText(FEEDBACK_STRINGS.fields.uploadButton)
        .closest('label') as HTMLLabelElement;
}

// ---------------------------------------------------------------------------
// Tests: always-rendered structure
// ---------------------------------------------------------------------------

describe('StepDetails — always-rendered structure', () => {
    it('should render severity label', () => {
        render(<StepDetails {...makeProps()} />);
        expect(screen.getByText(FEEDBACK_STRINGS.fields.severity)).toBeInTheDocument();
    });

    it('should render severity select with optional placeholder', () => {
        render(<StepDetails {...makeProps()} />);
        const select = screen.getByDisplayValue(FEEDBACK_STRINGS.fields.severityOptional);
        expect(select).toBeInTheDocument();
    });

    it('should render all severity options', () => {
        render(<StepDetails {...makeProps()} />);
        for (const level of SEVERITY_LEVELS) {
            expect(
                screen.getByRole('option', { name: new RegExp(level.label) })
            ).toBeInTheDocument();
        }
    });

    it('should render steps-to-reproduce label', () => {
        render(<StepDetails {...makeProps()} />);
        expect(screen.getByText(FEEDBACK_STRINGS.fields.stepsToReproduce)).toBeInTheDocument();
    });

    it('should render expected result textarea', () => {
        render(<StepDetails {...makeProps()} />);
        expect(
            screen.getByPlaceholderText(FEEDBACK_STRINGS.fields.expectedResultPlaceholder)
        ).toBeInTheDocument();
    });

    it('should render actual result textarea', () => {
        render(<StepDetails {...makeProps()} />);
        expect(
            screen.getByPlaceholderText(FEEDBACK_STRINGS.fields.actualResultPlaceholder)
        ).toBeInTheDocument();
    });

    it('should render the "Volver" button', () => {
        render(<StepDetails {...makeProps()} />);
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.back })
        ).toBeInTheDocument();
    });

    it('should render the "Enviar" button', () => {
        render(<StepDetails {...makeProps()} />);
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit })
        ).toBeInTheDocument();
    });

    it('should disable both buttons when isSubmitting=true', () => {
        render(<StepDetails {...makeProps({ isSubmitting: true })} />);
        expect(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.back })).toBeDisabled();
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit })
        ).toBeDisabled();
    });

    it('should enable both buttons when isSubmitting=false', () => {
        render(<StepDetails {...makeProps({ isSubmitting: false })} />);
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.back })
        ).not.toBeDisabled();
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit })
        ).not.toBeDisabled();
    });
});

// ---------------------------------------------------------------------------
// Tests: onChange handlers for step 2 fields
// ---------------------------------------------------------------------------

describe('StepDetails — onChange handlers', () => {
    it('should call onChange with "severity" when select changes to a severity', () => {
        const onChange = vi.fn();
        render(<StepDetails {...makeProps({ onChange })} />);
        const select = screen.getByDisplayValue(FEEDBACK_STRINGS.fields.severityOptional);
        fireEvent.change(select, { target: { value: 'high' } });
        expect(onChange).toHaveBeenCalledWith('severity', 'high');
    });

    it('should call onChange with undefined severity when empty option selected', () => {
        const onChange = vi.fn();
        render(<StepDetails {...makeProps({ onChange, data: makeData({ severity: 'high' }) })} />);
        const select = screen.getByDisplayValue(/Alto/);
        fireEvent.change(select, { target: { value: '' } });
        expect(onChange).toHaveBeenCalledWith('severity', undefined);
    });

    it('should call onChange with "stepsToReproduce" when textarea changes', () => {
        const onChange = vi.fn();
        render(<StepDetails {...makeProps({ onChange })} />);
        // Use label text to find the textarea (via aria-labelledby / htmlFor association)
        const label = screen.getByText(FEEDBACK_STRINGS.fields.stepsToReproduce);
        const labelFor = label.getAttribute('for') ?? label.getAttribute('htmlFor');
        const textarea = labelFor
            ? (document.getElementById(labelFor) as HTMLTextAreaElement)
            : (label.closest('div')?.querySelector('textarea') as HTMLTextAreaElement);
        fireEvent.change(textarea, { target: { value: '1. Go to page\n2. Click button' } });
        expect(onChange).toHaveBeenCalledWith('stepsToReproduce', '1. Go to page\n2. Click button');
    });

    it('should call onChange with undefined when stepsToReproduce is cleared', () => {
        const onChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({ onChange, data: makeData({ stepsToReproduce: 'some steps' }) })}
            />
        );
        const textarea = screen.getByDisplayValue('some steps');
        fireEvent.change(textarea, { target: { value: '' } });
        expect(onChange).toHaveBeenCalledWith('stepsToReproduce', undefined);
    });

    it('should call onChange with "expectedResult" when textarea changes', () => {
        const onChange = vi.fn();
        render(<StepDetails {...makeProps({ onChange })} />);
        const textarea = screen.getByPlaceholderText(
            FEEDBACK_STRINGS.fields.expectedResultPlaceholder
        );
        fireEvent.change(textarea, { target: { value: 'Should show login page' } });
        expect(onChange).toHaveBeenCalledWith('expectedResult', 'Should show login page');
    });

    it('should call onChange with undefined when expectedResult is cleared', () => {
        const onChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({ onChange, data: makeData({ expectedResult: 'something' }) })}
            />
        );
        const textarea = screen.getByDisplayValue('something');
        fireEvent.change(textarea, { target: { value: '' } });
        expect(onChange).toHaveBeenCalledWith('expectedResult', undefined);
    });

    it('should call onChange with "actualResult" when textarea changes', () => {
        const onChange = vi.fn();
        render(<StepDetails {...makeProps({ onChange })} />);
        const textarea = screen.getByPlaceholderText(
            FEEDBACK_STRINGS.fields.actualResultPlaceholder
        );
        fireEvent.change(textarea, { target: { value: 'Page shows blank screen' } });
        expect(onChange).toHaveBeenCalledWith('actualResult', 'Page shows blank screen');
    });

    it('should call onChange with undefined when actualResult is cleared', () => {
        const onChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({ onChange, data: makeData({ actualResult: 'something' }) })}
            />
        );
        const textarea = screen.getByDisplayValue('something');
        fireEvent.change(textarea, { target: { value: '' } });
        expect(onChange).toHaveBeenCalledWith('actualResult', undefined);
    });
});

// ---------------------------------------------------------------------------
// Tests: action button handlers
// ---------------------------------------------------------------------------

describe('StepDetails — action button handlers', () => {
    it('should call onBack when "Volver" button is clicked', () => {
        const onBack = vi.fn();
        render(<StepDetails {...makeProps({ onBack })} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.back }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('should call onSubmit when "Enviar" button is clicked', () => {
        const onSubmit = vi.fn();
        render(<StepDetails {...makeProps({ onSubmit })} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Tests: file attachment UI
// ---------------------------------------------------------------------------

describe('StepDetails — file attachment', () => {
    it('should show upload zone when attachments < maxAttachments', () => {
        render(<StepDetails {...makeProps({ attachments: [] })} />);
        expect(screen.getByText(FEEDBACK_STRINGS.fields.uploadButton)).toBeInTheDocument();
    });

    it('should hide upload zone when attachments = maxAttachments', () => {
        const maxFiles = Array.from(
            { length: FEEDBACK_CONFIG.maxAttachments },
            (_, i) => new File(['x'], `file${i}.png`, { type: 'image/png' })
        );
        render(<StepDetails {...makeProps({ attachments: maxFiles })} />);
        expect(screen.queryByText(FEEDBACK_STRINGS.fields.uploadButton)).not.toBeInTheDocument();
    });

    it('should display attachment list when attachments are provided', () => {
        const file = new File(['data'], 'screenshot.png', { type: 'image/png' });
        render(<StepDetails {...makeProps({ attachments: [file] })} />);
        expect(screen.getByText(/screenshot\.png/)).toBeInTheDocument();
    });

    it('should call onRemoveAttachment when remove button is clicked', () => {
        const onRemoveAttachment = vi.fn();
        const file = new File(['data'], 'capture.png', { type: 'image/png' });
        render(<StepDetails {...makeProps({ attachments: [file], onRemoveAttachment })} />);
        const removeBtn = screen.getByRole('button', {
            name: FEEDBACK_STRINGS.fields.removeFileLabel.replace('{name}', 'capture.png')
        });
        fireEvent.click(removeBtn);
        expect(onRemoveAttachment).toHaveBeenCalledWith(0);
    });

    it('should reject a file that exceeds maxFileSize and show rejection message', () => {
        const onAddAttachments = vi.fn();
        render(<StepDetails {...makeProps({ onAddAttachments })} />);

        // Create a file bigger than 10MB (mock size via Object.defineProperty)
        const bigFile = new File(['x'], 'big.png', { type: 'image/png' });
        Object.defineProperty(bigFile, 'size', { value: FEEDBACK_CONFIG.maxFileSize + 1 });

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: [bigFile] } });

        expect(onAddAttachments).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/big\.png/)).toBeInTheDocument();
    });

    it('should reject a file with a disallowed MIME type', () => {
        const onAddAttachments = vi.fn();
        render(<StepDetails {...makeProps({ onAddAttachments })} />);

        const pdfFile = new File(['data'], 'document.pdf', { type: 'application/pdf' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: [pdfFile] } });

        expect(onAddAttachments).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should accept a valid PNG file and call onAddAttachments', () => {
        const onAddAttachments = vi.fn();
        render(<StepDetails {...makeProps({ onAddAttachments })} />);

        const pngFile = new File(['data'], 'valid.png', { type: 'image/png' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: [pngFile] } });

        expect(onAddAttachments).toHaveBeenCalledTimes(1);
        expect(onAddAttachments.mock.calls[0][0][0].name).toBe('valid.png');
    });

    it('should handle empty file input gracefully', () => {
        const onAddAttachments = vi.fn();
        render(<StepDetails {...makeProps({ onAddAttachments })} />);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: null } });
        expect(onAddAttachments).not.toHaveBeenCalled();
    });

    it('should display formatted file size in KB for small files', () => {
        // 1025 bytes > 1024 → "1.0 KB"
        const file = new File(['x'], 'shot.png', { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 1025 });
        render(<StepDetails {...makeProps({ attachments: [file] })} />);
        const sizeSpan = document.querySelector('.attachmentSize');
        expect(sizeSpan?.textContent).toMatch(/KB/);
    });

    it('should display file size in bytes for sub-1KB files', () => {
        const file = new File(['x'], 'tiny.png', { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 512 });
        render(<StepDetails {...makeProps({ attachments: [file] })} />);
        const sizeSpan = document.querySelector('.attachmentSize');
        expect(sizeSpan?.textContent).toMatch(/512 B/);
    });
});

// ---------------------------------------------------------------------------
// Tests: collapsible tech details section
// ---------------------------------------------------------------------------

describe('StepDetails — tech details section', () => {
    it('should render the tech details title text', () => {
        render(<StepDetails {...makeProps()} />);
        // The title is inside a span within the toggle button
        expect(screen.getByText(FEEDBACK_STRINGS.techDetails.title)).toBeInTheDocument();
    });

    it('should toggle tech details open on click', () => {
        render(<StepDetails {...makeProps()} />);
        // Initially hidden
        expect(screen.queryByText(FEEDBACK_STRINGS.techDetails.url)).not.toBeInTheDocument();

        openTechDetails();

        // Now visible
        expect(screen.getByText(FEEDBACK_STRINGS.techDetails.url)).toBeInTheDocument();
    });

    it('should show aria-expanded=true when tech details open', () => {
        render(<StepDetails {...makeProps()} />);
        const titleSpan = screen.getByText(FEEDBACK_STRINGS.techDetails.title);
        const toggle = titleSpan.closest('button') as HTMLElement;
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('should show aria-expanded=false initially (tech details closed)', () => {
        render(<StepDetails {...makeProps()} />);
        const titleSpan = screen.getByText(FEEDBACK_STRINGS.techDetails.title);
        const toggle = titleSpan.closest('button') as HTMLElement;
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('should close tech details when clicked a second time', () => {
        render(<StepDetails {...makeProps()} />);
        openTechDetails();
        expect(screen.getByText(FEEDBACK_STRINGS.techDetails.url)).toBeInTheDocument();

        openTechDetails(); // click again to close
        expect(screen.queryByText(FEEDBACK_STRINGS.techDetails.url)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: tech details field changes
// ---------------------------------------------------------------------------

describe('StepDetails — tech details field changes', () => {
    it('should call onEnvironmentChange with "locale" when locale input changes', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ locale: 'es' })
                })}
            />
        );
        openTechDetails();
        const localeInput = screen.getByDisplayValue('es');
        fireEvent.change(localeInput, { target: { value: 'en' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('locale', 'en');
    });

    it('should call onEnvironmentChange with undefined when locale input is cleared', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ locale: 'es' })
                })}
            />
        );
        openTechDetails();
        const localeInput = screen.getByDisplayValue('es');
        fireEvent.change(localeInput, { target: { value: '' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('locale', undefined);
    });

    it('should call onEnvironmentChange with "timezone" when timezone input changes', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ timezone: 'UTC' })
                })}
            />
        );
        openTechDetails();
        const tzInput = screen.getByDisplayValue('UTC');
        fireEvent.change(tzInput, { target: { value: 'America/Buenos_Aires' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('timezone', 'America/Buenos_Aires');
    });

    it('should call onEnvironmentChange with "browser" when browser input changes', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ browser: 'Chrome 120' })
                })}
            />
        );
        openTechDetails();
        const browserInput = screen.getByDisplayValue('Chrome 120');
        fireEvent.change(browserInput, { target: { value: 'Firefox 115' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('browser', 'Firefox 115');
    });

    it('should call onEnvironmentChange with undefined when browser input cleared', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ browser: 'Chrome 120' })
                })}
            />
        );
        openTechDetails();
        const browserInput = screen.getByDisplayValue('Chrome 120');
        fireEvent.change(browserInput, { target: { value: '' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('browser', undefined);
    });

    it('should call onEnvironmentChange with "os" when os input changes', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ os: 'Windows 11' })
                })}
            />
        );
        openTechDetails();
        const osInput = screen.getByDisplayValue('Windows 11');
        fireEvent.change(osInput, { target: { value: 'macOS 14' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('os', 'macOS 14');
    });

    it('should call onEnvironmentChange with "viewport" when viewport input changes', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ viewport: '1920x1080' })
                })}
            />
        );
        openTechDetails();
        const viewportInput = screen.getByDisplayValue('1920x1080');
        fireEvent.change(viewportInput, { target: { value: '1280x720' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('viewport', '1280x720');
    });

    it('should call onEnvironmentChange with "currentUrl" when url input changes', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ currentUrl: 'https://example.com/page' })
                })}
            />
        );
        openTechDetails();
        const urlInput = screen.getByDisplayValue('https://example.com/page');
        fireEvent.change(urlInput, { target: { value: 'https://example.com/new' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('currentUrl', 'https://example.com/new');
    });

    it('should call onEnvironmentChange with undefined when url input is cleared', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ currentUrl: 'https://example.com/page' })
                })}
            />
        );
        openTechDetails();
        const urlInput = screen.getByDisplayValue('https://example.com/page');
        fireEvent.change(urlInput, { target: { value: '' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('currentUrl', undefined);
    });

    it('should call onEnvironmentChange with "deployVersion" when version input changes', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ deployVersion: 'v1.0.0' })
                })}
            />
        );
        openTechDetails();
        const versionInput = screen.getByDisplayValue('v1.0.0');
        fireEvent.change(versionInput, { target: { value: 'v2.0.0' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('deployVersion', 'v2.0.0');
    });

    it('should call onEnvironmentChange with "colorScheme=dark" when select changes', () => {
        const onEnvironmentChange = vi.fn();
        render(<StepDetails {...makeProps({ onEnvironmentChange })} />);
        openTechDetails();
        // After opening, find the colorScheme select by its label
        const colorSchemeLabel = screen.getByText(FEEDBACK_STRINGS.techDetails.colorScheme);
        const labelFor =
            colorSchemeLabel.getAttribute('for') ?? colorSchemeLabel.getAttribute('htmlFor');
        const select = labelFor ? (document.getElementById(labelFor) as HTMLSelectElement) : null;
        if (select) {
            fireEvent.change(select, { target: { value: 'dark' } });
            expect(onEnvironmentChange).toHaveBeenCalledWith('colorScheme', 'dark');
        } else {
            // fallback: find by parent container
            const selectEl = colorSchemeLabel
                .closest('div')
                ?.querySelector('select') as HTMLSelectElement;
            fireEvent.change(selectEl, { target: { value: 'dark' } });
            expect(onEnvironmentChange).toHaveBeenCalledWith('colorScheme', 'dark');
        }
    });

    it('should call onEnvironmentChange with "deviceType=mobile" when select changes', () => {
        const onEnvironmentChange = vi.fn();
        render(<StepDetails {...makeProps({ onEnvironmentChange })} />);
        openTechDetails();
        const deviceLabel = screen.getByText(FEEDBACK_STRINGS.techDetails.deviceType);
        const labelFor = deviceLabel.getAttribute('for') ?? deviceLabel.getAttribute('htmlFor');
        const select = labelFor ? (document.getElementById(labelFor) as HTMLSelectElement) : null;
        if (select) {
            fireEvent.change(select, { target: { value: 'mobile' } });
            expect(onEnvironmentChange).toHaveBeenCalledWith('deviceType', 'mobile');
        } else {
            const selectEl = deviceLabel
                .closest('div')
                ?.querySelector('select') as HTMLSelectElement;
            fireEvent.change(selectEl, { target: { value: 'mobile' } });
            expect(onEnvironmentChange).toHaveBeenCalledWith('deviceType', 'mobile');
        }
    });

    it('should call onEnvironmentChange with "connectionType" when input changes', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ connectionType: '4g' })
                })}
            />
        );
        openTechDetails();
        const connInput = screen.getByDisplayValue('4g');
        fireEvent.change(connInput, { target: { value: 'wifi' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('connectionType', 'wifi');
    });

    it('should call onEnvironmentChange with "sentryEventId" when input changes', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ sentryEventId: 'abc-123' })
                })}
            />
        );
        openTechDetails();
        const sentryInput = screen.getByDisplayValue('abc-123');
        fireEvent.change(sentryInput, { target: { value: 'def-456' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('sentryEventId', 'def-456');
    });

    it('should call onEnvironmentChange with undefined when sentryEventId cleared', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ sentryEventId: 'abc-123' })
                })}
            />
        );
        openTechDetails();
        const sentryInput = screen.getByDisplayValue('abc-123');
        fireEvent.change(sentryInput, { target: { value: '' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('sentryEventId', undefined);
    });
});

// ---------------------------------------------------------------------------
// Tests: consoleErrors field in tech section
// ---------------------------------------------------------------------------

describe('StepDetails — consoleErrors field', () => {
    it('should display consoleErrors text in the textarea', () => {
        render(
            <StepDetails
                {...makeProps({
                    environment: makeEnvironment({ consoleErrors: ['Error 1', 'Error 2'] })
                })}
            />
        );
        openTechDetails();
        // Use id lookup to avoid newline-in-string matching issues
        const textarea = document.getElementById('tech-console-errors') as HTMLTextAreaElement;
        expect(textarea).toBeInTheDocument();
        expect(textarea.value).toBe('Error 1\nError 2');
    });

    it('should call onEnvironmentChange with parsed console errors on change', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ consoleErrors: ['Old error'] })
                })}
            />
        );
        openTechDetails();
        const textarea = screen.getByDisplayValue('Old error');
        fireEvent.change(textarea, { target: { value: 'New error 1\nNew error 2' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('consoleErrors', [
            'New error 1',
            'New error 2'
        ]);
    });

    it('should call onEnvironmentChange with undefined when consoleErrors cleared', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ consoleErrors: ['Old error'] })
                })}
            />
        );
        openTechDetails();
        const textarea = screen.getByDisplayValue('Old error');
        fireEvent.change(textarea, { target: { value: '' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('consoleErrors', undefined);
    });
});

// ---------------------------------------------------------------------------
// Tests: errorInfo fields in tech section
// ---------------------------------------------------------------------------

describe('StepDetails — errorInfo fields', () => {
    it('should call onEnvironmentChange with updated errorInfo message', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({
                        errorInfo: { message: 'Old error', stack: 'at App.tsx:10' }
                    })
                })}
            />
        );
        openTechDetails();
        const msgInput = screen.getByDisplayValue('Old error');
        fireEvent.change(msgInput, { target: { value: 'New error message' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('errorInfo', {
            message: 'New error message',
            stack: 'at App.tsx:10'
        });
    });

    it('should call onEnvironmentChange with undefined errorInfo when message cleared and no stack', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({
                        errorInfo: { message: 'msg', stack: undefined }
                    })
                })}
            />
        );
        openTechDetails();
        const msgInput = screen.getByDisplayValue('msg');
        fireEvent.change(msgInput, { target: { value: '' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('errorInfo', undefined);
    });

    it('should call onEnvironmentChange with updated errorInfo stack', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({
                        errorInfo: { message: 'Some error', stack: 'at old.tsx:5' }
                    })
                })}
            />
        );
        openTechDetails();
        const stackTextarea = screen.getByDisplayValue('at old.tsx:5');
        fireEvent.change(stackTextarea, { target: { value: 'at new.tsx:10' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('errorInfo', {
            message: 'Some error',
            stack: 'at new.tsx:10'
        });
    });
});

// ---------------------------------------------------------------------------
// Tests: featureFlags field in tech section
// ---------------------------------------------------------------------------

describe('StepDetails — featureFlags field', () => {
    it('should display feature flags as key=value lines', () => {
        render(
            <StepDetails
                {...makeProps({
                    environment: makeEnvironment({
                        featureFlags: { darkMode: 'true' }
                    })
                })}
            />
        );
        openTechDetails();
        const textarea = screen.getByDisplayValue(/darkMode=true/);
        expect(textarea).toBeInTheDocument();
    });

    it('should call onEnvironmentChange with parsed flags on change', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({
                        featureFlags: { darkMode: 'true' }
                    })
                })}
            />
        );
        openTechDetails();
        const textarea = screen.getByDisplayValue('darkMode=true');
        fireEvent.change(textarea, { target: { value: 'newFlag=enabled' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('featureFlags', { newFlag: 'enabled' });
    });

    it('should call onEnvironmentChange with undefined when featureFlags textarea cleared', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ featureFlags: { a: '1' } })
                })}
            />
        );
        openTechDetails();
        const textarea = screen.getByDisplayValue('a=1');
        fireEvent.change(textarea, { target: { value: '' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('featureFlags', undefined);
    });
});

// ---------------------------------------------------------------------------
// Tests: navigationHistory field in tech section
// ---------------------------------------------------------------------------

describe('StepDetails — navigationHistory field', () => {
    it('should display navigation history as one URL per line', () => {
        render(
            <StepDetails
                {...makeProps({
                    environment: makeEnvironment({
                        navigationHistory: ['/page-a', '/page-b']
                    })
                })}
            />
        );
        openTechDetails();
        // Use id lookup to avoid newline-in-string matching issues
        const textarea = document.getElementById('tech-nav-history') as HTMLTextAreaElement;
        expect(textarea).toBeInTheDocument();
        expect(textarea.value).toBe('/page-a\n/page-b');
    });

    it('should call onEnvironmentChange with parsed history on change', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ navigationHistory: ['/old-page'] })
                })}
            />
        );
        openTechDetails();
        const textarea = screen.getByDisplayValue('/old-page');
        fireEvent.change(textarea, { target: { value: '/new-page\n/another-page' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('navigationHistory', [
            '/new-page',
            '/another-page'
        ]);
    });

    it('should call onEnvironmentChange with undefined when history cleared', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ navigationHistory: ['/old-page'] })
                })}
            />
        );
        openTechDetails();
        const textarea = screen.getByDisplayValue('/old-page');
        fireEvent.change(textarea, { target: { value: '' } });
        expect(onEnvironmentChange).toHaveBeenCalledWith('navigationHistory', undefined);
    });
});

// ---------------------------------------------------------------------------
// Tests: lastInteractions in tech section (read-only + clear button)
// ---------------------------------------------------------------------------

describe('StepDetails — lastInteractions', () => {
    const sampleInteraction = {
        type: 'BUTTON',
        selector: '#btn',
        timestamp: '2024-01-01T00:00:00.000Z',
        text: 'Submit form',
        event: 'click' as const
    };

    it('should show the clear button when lastInteractions exist', () => {
        render(
            <StepDetails
                {...makeProps({
                    environment: makeEnvironment({ lastInteractions: [sampleInteraction] })
                })}
            />
        );
        openTechDetails();
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.techDetails.clearField })
        ).toBeInTheDocument();
    });

    it('should NOT show the clear button when lastInteractions are empty', () => {
        render(
            <StepDetails
                {...makeProps({ environment: makeEnvironment({ lastInteractions: [] }) })}
            />
        );
        openTechDetails();
        expect(
            screen.queryByRole('button', { name: FEEDBACK_STRINGS.techDetails.clearField })
        ).not.toBeInTheDocument();
    });

    it('should call onEnvironmentChange with undefined when clear button clicked', () => {
        const onEnvironmentChange = vi.fn();
        render(
            <StepDetails
                {...makeProps({
                    onEnvironmentChange,
                    environment: makeEnvironment({ lastInteractions: [sampleInteraction] })
                })}
            />
        );
        openTechDetails();
        const clearBtn = screen.getByRole('button', {
            name: FEEDBACK_STRINGS.techDetails.clearField
        });
        fireEvent.click(clearBtn);
        expect(onEnvironmentChange).toHaveBeenCalledWith('lastInteractions', undefined);
    });

    it('should display last interactions in read-only textarea', () => {
        render(
            <StepDetails
                {...makeProps({
                    environment: makeEnvironment({ lastInteractions: [sampleInteraction] })
                })}
            />
        );
        openTechDetails();
        expect(screen.getByDisplayValue(/Submit form/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: formatInteraction branches (ariaLabel and fallback)
// ---------------------------------------------------------------------------

describe('StepDetails — formatInteraction display variants', () => {
    it('should display interaction using ariaLabel when text is absent', () => {
        render(
            <StepDetails
                {...makeProps({
                    environment: makeEnvironment({
                        lastInteractions: [
                            {
                                type: 'BUTTON',
                                selector: '#icon-btn',
                                timestamp: '2024-01-01T00:00:00.000Z',
                                ariaLabel: 'Close dialog',
                                event: 'click' as const
                            }
                        ]
                    })
                })}
            />
        );
        openTechDetails();
        expect(screen.getByDisplayValue(/Close dialog/)).toBeInTheDocument();
    });

    it('should display interaction fallback using type+selector when no text/ariaLabel', () => {
        render(
            <StepDetails
                {...makeProps({
                    environment: makeEnvironment({
                        lastInteractions: [
                            {
                                type: 'BUTTON',
                                selector: '#mystery-btn',
                                timestamp: '2024-01-01T00:00:00.000Z',
                                event: 'click' as const
                            }
                        ]
                    })
                })}
            />
        );
        openTechDetails();
        expect(screen.getByDisplayValue(/#mystery-btn/)).toBeInTheDocument();
    });

    it('should include href in formatted interaction when present', () => {
        render(
            <StepDetails
                {...makeProps({
                    environment: makeEnvironment({
                        lastInteractions: [
                            {
                                type: 'A',
                                selector: 'a#link',
                                timestamp: '2024-01-01T00:00:00.000Z',
                                text: 'Go to page',
                                event: 'click' as const,
                                href: '/target-page'
                            }
                        ]
                    })
                })}
            />
        );
        openTechDetails();
        const textarea = screen.getByDisplayValue(/Go to page/) as HTMLTextAreaElement;
        expect(textarea.value).toMatch(/\/target-page/);
    });

    it('should include domPath in formatted interaction when present', () => {
        render(
            <StepDetails
                {...makeProps({
                    environment: makeEnvironment({
                        lastInteractions: [
                            {
                                type: 'BUTTON',
                                selector: '#main-btn',
                                timestamp: '2024-01-01T00:00:00.000Z',
                                text: 'Main button',
                                event: 'click' as const,
                                domPath: 'div>nav>button'
                            }
                        ]
                    })
                })}
            />
        );
        openTechDetails();
        const textarea = screen.getByDisplayValue(/Main button/) as HTMLTextAreaElement;
        expect(textarea.value).toMatch(/div>nav>button/);
    });
});

// ---------------------------------------------------------------------------
// Tests: drag-and-drop extra branches
// ---------------------------------------------------------------------------

describe('StepDetails — drag-and-drop extra branches', () => {
    it('should not call onAddAttachments when drop has no files', () => {
        const onAddAttachments = vi.fn();
        render(<StepDetails {...makeProps({ onAddAttachments })} />);
        const zone = getUploadZone();
        fireEvent.drop(zone, { dataTransfer: { files: [] } });
        expect(onAddAttachments).not.toHaveBeenCalled();
    });

    it('should show file size in MB for large files', () => {
        // 1.5 MB file
        const bigFile = new File(['x'.repeat(100)], 'large.png', { type: 'image/png' });
        Object.defineProperty(bigFile, 'size', { value: 1_572_864 }); // 1.5 MB
        render(<StepDetails {...makeProps({ attachments: [bigFile] })} />);
        // The attachment size span contains the formatted size with "MB"
        const sizeSpan = document.querySelector('.attachmentSize');
        expect(sizeSpan?.textContent).toMatch(/1\.5 MB/);
    });

    it('should call onAddAttachments with valid dropped files', () => {
        const onAddAttachments = vi.fn();
        render(<StepDetails {...makeProps({ onAddAttachments })} />);
        const zone = getUploadZone();
        const validFile = new File(['data'], 'shot.jpg', { type: 'image/jpeg' });
        fireEvent.drop(zone, { dataTransfer: { files: [validFile] } });
        expect(onAddAttachments).toHaveBeenCalledTimes(1);
    });
});
