import { RichTextFeatureEnum } from '@/components/entity-form/enums/form-config.enums';
import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Label, Textarea } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { useFieldI18n } from '@/lib/utils/i18n-field.utils';
import { Bold, Italic, Link, List, ListOrdered, Underline } from 'lucide-react';
import * as React from 'react';

/**
 * Rich text feature types
 */
export type RichTextFeature =
    | 'bold'
    | 'italic'
    | 'underline'
    | 'link'
    | 'list'
    | 'orderedList'
    | 'paragraph'
    | 'heading1'
    | 'heading2'
    | 'heading3';

/**
 * Props for RichTextField component
 */
export interface RichTextFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: string;
    /** Change handler */
    onChange?: (value: string) => void;
    /** Blur handler */
    onBlur?: () => void;
    /** Focus handler */
    onFocus?: () => void;
    /** Whether the field has an error */
    hasError?: boolean;
    /** Error message to display */
    errorMessage?: string;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** Whether the field is required */
    required?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * RichTextField component for rich text editing
 * Handles RICH_TEXT field type from FieldConfig
 *
 * Note: This is a simplified implementation using textarea with toolbar.
 * In a production app, you'd want to integrate a proper rich text editor
 * like TipTap, Lexical, or similar.
 */
export const RichTextField = React.forwardRef<HTMLTextAreaElement, RichTextFieldProps>(
    (
        {
            config,
            value = '',
            onChange,
            onBlur,
            onFocus,
            hasError = false,
            errorMessage,
            disabled = false,
            required = false,
            className,
            ...props
        },
        ref
    ) => {
        const { label, description, placeholder, helper } = useFieldI18n(config.id, config.i18n);

        // Get rich text specific config
        const richTextConfig =
            config.typeConfig?.type === 'RICH_TEXT' ? config.typeConfig : undefined;

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        const allowedFeatures = richTextConfig?.allowedFeatures || [];
        const minLength = richTextConfig?.minLength;
        const maxLength = richTextConfig?.maxLength;

        // Textarea ref for text manipulation
        const textareaRef = React.useRef<HTMLTextAreaElement>(null);

        // Combine refs
        React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

        const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            onChange?.(e.target.value);
        };

        // Simple text manipulation functions
        const wrapSelectedText = (prefix: string, suffix: string = prefix) => {
            const textarea = textareaRef.current;
            if (!textarea || disabled) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = value.substring(start, end);

            const beforeText = value.substring(0, start);
            const afterText = value.substring(end);

            const newText = `${beforeText}${prefix}${selectedText}${suffix}${afterText}`;
            onChange?.(newText);

            // Restore selection
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + prefix.length, end + prefix.length);
            }, 0);
        };

        const insertText = (text: string) => {
            const textarea = textareaRef.current;
            if (!textarea || disabled) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            const beforeText = value.substring(0, start);
            const afterText = value.substring(end);

            const newText = `${beforeText}${text}${afterText}`;
            onChange?.(newText);

            // Move cursor to end of inserted text
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + text.length, start + text.length);
            }, 0);
        };

        // Toolbar actions
        const toolbarActions: Record<RichTextFeatureEnum, () => void> = {
            [RichTextFeatureEnum.BOLD]: () => wrapSelectedText('**'),
            [RichTextFeatureEnum.ITALIC]: () => wrapSelectedText('*'),
            [RichTextFeatureEnum.UNDERLINE]: () => wrapSelectedText('<u>', '</u>'),
            [RichTextFeatureEnum.LINK]: () => {
                const url = prompt('Enter URL:');
                if (url) {
                    const textarea = textareaRef.current;
                    const start = textarea?.selectionStart || 0;
                    const end = textarea?.selectionEnd || 0;
                    const selectedText = value.substring(start, end) || 'Link text';
                    wrapSelectedText(`[${selectedText}](${url})`, '');
                }
            },
            [RichTextFeatureEnum.LIST]: () => insertText('\n- '),
            [RichTextFeatureEnum.ORDERED_LIST]: () => insertText('\n1. '),
            [RichTextFeatureEnum.HEADING]: () => insertText('\n# '),
            [RichTextFeatureEnum.QUOTE]: () => insertText('\n> '),
            [RichTextFeatureEnum.CODE]: () => wrapSelectedText('`'),
            [RichTextFeatureEnum.STRIKETHROUGH]: () => wrapSelectedText('~~'),
            [RichTextFeatureEnum.TABLE]: () =>
                insertText(
                    '\n| Column 1 | Column 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n'
                ),
            [RichTextFeatureEnum.IMAGE]: () => {
                const url = prompt('Enter image URL:');
                if (url) {
                    const alt = prompt('Enter alt text:') || 'Image';
                    insertText(`![${alt}](${url})`);
                }
            }
        };

        // Toolbar button configuration
        const toolbarButtons = [
            { feature: RichTextFeatureEnum.BOLD, icon: Bold, label: 'Bold' },
            { feature: RichTextFeatureEnum.ITALIC, icon: Italic, label: 'Italic' },
            { feature: RichTextFeatureEnum.UNDERLINE, icon: Underline, label: 'Underline' },
            { feature: RichTextFeatureEnum.LINK, icon: Link, label: 'Link' },
            { feature: RichTextFeatureEnum.LIST, icon: List, label: 'Bullet List' },
            { feature: RichTextFeatureEnum.ORDERED_LIST, icon: ListOrdered, label: 'Numbered List' }
        ];

        const availableButtons = toolbarButtons.filter(
            (button) => allowedFeatures.length === 0 || allowedFeatures.includes(button.feature)
        );

        return (
            <div className={cn('space-y-2', className)}>
                {/* Label */}
                {label && (
                    <Label
                        htmlFor={fieldId}
                        className={cn(
                            required && 'after:ml-0.5 after:text-destructive after:content-["*"]'
                        )}
                    >
                        {label}
                    </Label>
                )}

                {/* Description */}
                {description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-sm"
                    >
                        {description}
                    </p>
                )}

                {/* Rich Text Editor */}
                <div
                    className={cn(
                        'rounded-md border',
                        hasError && 'border-destructive',
                        disabled && 'opacity-50'
                    )}
                >
                    {/* Toolbar */}
                    {availableButtons.length > 0 && (
                        <div className="flex items-center gap-1 border-b bg-muted/50 p-2">
                            {availableButtons.map((button) => {
                                const Icon = button.icon;
                                return (
                                    <button
                                        key={button.feature}
                                        type="button"
                                        onClick={() => toolbarActions[button.feature]?.()}
                                        disabled={disabled}
                                        className={cn(
                                            'rounded p-2 hover:bg-accent hover:text-accent-foreground',
                                            'disabled:cursor-not-allowed disabled:opacity-50'
                                        )}
                                        title={button.label}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Text Area */}
                    <Textarea
                        ref={textareaRef}
                        id={fieldId}
                        value={value}
                        onChange={handleChange}
                        onBlur={onBlur}
                        onFocus={onFocus}
                        placeholder={placeholder || 'Enter your text...'}
                        disabled={disabled}
                        required={required}
                        minLength={minLength}
                        maxLength={maxLength}
                        className={cn(
                            'min-h-[120px] resize-none border-0 focus-visible:ring-0',
                            config.className
                        )}
                        aria-invalid={hasError}
                        aria-describedby={cn(errorId, descriptionId, helperId).trim() || undefined}
                        {...props}
                    />
                </div>

                {/* Character count */}
                {maxLength && (
                    <div className="flex justify-end">
                        <span
                            className={cn(
                                'text-muted-foreground text-xs',
                                value.length > maxLength && 'text-destructive'
                            )}
                        >
                            {value.length}/{maxLength}
                        </span>
                    </div>
                )}

                {/* Helper Text */}
                {helper && !hasError && (
                    <p
                        id={helperId}
                        className="text-muted-foreground text-sm"
                    >
                        {helper}
                    </p>
                )}

                {/* Error Message */}
                {hasError && errorMessage && (
                    <p
                        id={errorId}
                        className="text-destructive text-sm"
                    >
                        {errorMessage}
                    </p>
                )}
            </div>
        );
    }
);

RichTextField.displayName = 'RichTextField';
