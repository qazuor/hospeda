import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { useFieldI18n } from '@/lib/utils/i18n-field.utils';
import * as React from 'react';

/**
 * Props for RichTextViewField component
 */
export interface RichTextViewFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: string;
    /** Additional CSS classes */
    className?: string;
    /** Whether to show the label */
    showLabel?: boolean;
    /** Whether to show the description */
    showDescription?: boolean;
    /** Maximum height for content */
    maxHeight?: string;
    /** Whether to show character count */
    showCharCount?: boolean;
    /** Whether to render as HTML or plain text */
    renderAsHtml?: boolean;
}

/**
 * RichTextViewField component for displaying rich text content
 * Handles RICH_TEXT field type in view mode
 */
export const RichTextViewField = React.forwardRef<HTMLDivElement, RichTextViewFieldProps>(
    (
        {
            config,
            value = '',
            className,
            showLabel = true,
            showDescription = false,
            maxHeight = '300px',
            showCharCount = false,
            renderAsHtml = true,
            ...props
        },
        ref
    ) => {
        const { label, description } = useFieldI18n(config.id, config.i18n);

        // Get rich text specific config
        const richTextConfig =
            config.typeConfig?.type === 'RICH_TEXT' ? config.typeConfig : undefined;

        const fieldId = `view-field-${config.id}`;
        const descriptionId = description ? `${fieldId}-description` : undefined;

        const maxLength = richTextConfig?.maxLength;

        // Simple markdown-like parsing for basic formatting
        const parseMarkdown = (text: string): string => {
            return (
                text
                    // Bold
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    // Italic
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    // Underline
                    .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
                    // Links
                    .replace(
                        /\[([^\]]+)\]\(([^)]+)\)/g,
                        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>'
                    )
                    // Headings
                    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
                    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
                    // Bullet lists
                    .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
                    .replace(
                        /(<li.*<\/li>)/s,
                        '<ul class="list-disc list-inside space-y-1">$1</ul>'
                    )
                    // Numbered lists
                    .replace(/^\d+\. (.*$)/gm, '<li class="ml-4">$1</li>')
                    .replace(
                        /(<li.*<\/li>)/s,
                        '<ol class="list-decimal list-inside space-y-1">$1</ol>'
                    )
                    // Paragraphs
                    .replace(/\n\n/g, '</p><p class="mb-2">')
                    .replace(/^(.+)$/gm, '<p class="mb-2">$1</p>')
                    // Clean up empty paragraphs
                    .replace(/<p class="mb-2"><\/p>/g, '')
            );
        };

        const renderContent = () => {
            if (!value.trim()) {
                return <span className="text-muted-foreground italic">No content</span>;
            }

            if (renderAsHtml) {
                const htmlContent = parseMarkdown(value);
                return (
                    <div
                        className={cn(
                            'prose prose-sm max-w-none',
                            'prose-headings:text-foreground',
                            'prose-p:text-foreground prose-p:leading-relaxed',
                            'prose-strong:font-semibold prose-strong:text-foreground',
                            'prose-em:text-foreground',
                            'prose-ol:text-foreground prose-ul:text-foreground',
                            'prose-li:text-foreground',
                            maxHeight && 'overflow-y-auto'
                        )}
                        style={{ maxHeight }}
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: Controlled HTML content from markdown parsing
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />
                );
            }

            // Plain text with basic formatting preserved
            return (
                <div
                    className={cn(
                        'whitespace-pre-wrap text-sm leading-relaxed',
                        maxHeight && 'overflow-y-auto'
                    )}
                    style={{ maxHeight }}
                >
                    {value}
                </div>
            );
        };

        return (
            <div
                ref={ref}
                className={cn('space-y-2', className)}
                {...props}
            >
                {/* Label */}
                {showLabel && label && (
                    <Label className="font-medium text-muted-foreground text-sm">{label}</Label>
                )}

                {/* Description */}
                {showDescription && description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-xs"
                    >
                        {description}
                    </p>
                )}

                {/* Content */}
                <div
                    className={cn(
                        'rounded-md border bg-muted/30 p-3',
                        !value.trim() && 'border-dashed',
                        config.className
                    )}
                    aria-describedby={descriptionId}
                >
                    {renderContent()}
                </div>

                {/* Character Count */}
                {showCharCount && value && (
                    <div className="flex justify-between text-muted-foreground text-xs">
                        <span>{value.length} characters</span>
                        {maxLength && (
                            <span className={cn(value.length > maxLength && 'text-destructive')}>
                                {value.length}/{maxLength}
                            </span>
                        )}
                    </div>
                )}

                {/* Content Preview Info */}
                {value && (
                    <div className="text-muted-foreground text-xs">
                        {renderAsHtml ? 'Formatted content' : 'Plain text'}
                        {value.split('\n').length > 1 && ` • ${value.split('\n').length} lines`}
                        {value.split(' ').length > 1 && ` • ${value.split(' ').length} words`}
                    </div>
                )}
            </div>
        );
    }
);

RichTextViewField.displayName = 'RichTextViewField';
