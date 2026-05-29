import { FieldWrapper } from '@/components/entity-form/components/FieldWrapper';
import {
    FieldTypeEnum,
    RichTextFeatureEnum
} from '@/components/entity-form/enums/form-config.enums';
import type {
    FieldConfig,
    RichTextFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { cn } from '@/lib/utils';
import {
    BoldIcon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    QuotesIcon,
    UnderlineIcon
} from '@repo/icons';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import * as React from 'react';
import { Markdown } from 'tiptap-markdown';

/**
 * Props for RichTextField component.
 *
 * Public shape preserved from the legacy textarea-based implementation so
 * existing EntityFormSection wiring keeps working.
 */
export interface RichTextFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value — Markdown string */
    value?: string;
    /** Change handler — emits a Markdown string */
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
 * Legacy alias retained for downstream type imports — the union is no longer
 * used internally but other modules re-export it.
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
 * RichTextField — TipTap WYSIWYG editor persisting content as Markdown.
 *
 * Spec §4.6: description-class fields use a TipTap editor with toolbar
 * (bold, italic, headings, lists, blockquote, link). Content is stored
 * as Markdown via the `tiptap-markdown` extension so the value round-trips
 * cleanly to the existing markdown-aware view renderer.
 *
 * SSR note: `immediatelyRender: false` is required for TanStack Start.
 * Without it, useEditor renders during SSR and hydration mismatches.
 */
export function RichTextField({
    config,
    value = '',
    onChange,
    onBlur,
    onFocus,
    hasError = false,
    errorMessage,
    disabled = false,
    required = false,
    className
}: RichTextFieldProps) {
    const label = config.label;
    const description = config.description;
    const placeholder = config.placeholder;

    const fieldId = `field-${config.id}`;

    // Get rich text specific config
    const richTextConfig =
        config.type === FieldTypeEnum.RICH_TEXT
            ? (config.typeConfig as RichTextFieldConfig | undefined)
            : undefined;
    const maxLength = richTextConfig?.maxLength;
    const allowedFeatures = richTextConfig?.allowedFeatures ?? [];

    const editor = useEditor({
        immediatelyRender: false,
        editable: !disabled,
        content: value,
        extensions: [
            StarterKit.configure({
                // Headings exposed via toolbar — limit to h2/h3 to keep the
                // admin's typographic hierarchy intact (h1 is reserved for the
                // page title in EntityPageHeader).
                heading: { levels: [2, 3] }
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline underline-offset-2 hover:no-underline'
                }
            }),
            Markdown.configure({
                html: false, // round-trip strictly via markdown
                linkify: true,
                breaks: false,
                transformPastedText: true
            })
        ],
        editorProps: {
            attributes: {
                id: fieldId,
                role: 'textbox',
                'aria-multiline': 'true',
                'aria-required': required ? 'true' : 'false',
                'aria-invalid': hasError ? 'true' : 'false',
                class: cn(
                    'prose prose-sm dark:prose-invert max-w-none px-3 py-2 outline-none',
                    'min-h-[140px]',
                    'prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5',
                    'prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0',
                    'prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:pl-3'
                )
            }
        },
        onUpdate({ editor: ed }) {
            const md = ed.storage.markdown?.getMarkdown?.() ?? '';
            onChange?.(md);
        },
        onBlur() {
            onBlur?.();
        },
        onFocus() {
            onFocus?.();
        }
    });

    // Keep the editor in sync when the controlled `value` changes externally
    // (e.g. form reset). Only update when actually different to avoid jumpy
    // selection state on every keystroke.
    React.useEffect(() => {
        if (!editor) return;
        const currentMd: string = editor.storage.markdown?.getMarkdown?.() ?? '';
        if ((value ?? '') !== currentMd) {
            editor.commands.setContent(value ?? '', false);
        }
    }, [editor, value]);

    // Toggle editor.editable when `disabled` flips after mount.
    React.useEffect(() => {
        if (!editor) return;
        editor.setEditable(!disabled);
    }, [editor, disabled]);

    if (!editor) {
        return (
            <FieldWrapper
                fieldId={fieldId}
                label={label}
                required={required}
                description={description}
                hasError={hasError}
                errorMessage={errorMessage}
                mode="edit"
                charCount={maxLength !== undefined ? (value ?? '').length : undefined}
                maxLength={maxLength}
                className={className}
            >
                <div
                    className={cn(
                        'min-h-[140px] rounded-md border bg-background px-3 py-2 text-muted-foreground text-sm',
                        hasError && 'border-destructive'
                    )}
                    aria-busy="true"
                >
                    {placeholder ?? ''}
                </div>
            </FieldWrapper>
        );
    }

    const isFeatureAllowed = (feature: RichTextFeatureEnum): boolean =>
        allowedFeatures.length === 0 || allowedFeatures.includes(feature);

    return (
        <FieldWrapper
            fieldId={fieldId}
            label={label}
            required={required}
            description={description}
            hasError={hasError}
            errorMessage={errorMessage}
            mode="edit"
            charCount={maxLength !== undefined ? (value ?? '').length : undefined}
            maxLength={maxLength}
            className={className}
        >
            <div
                className={cn(
                    'overflow-hidden rounded-md border bg-background',
                    'focus-within:ring-1 focus-within:ring-ring',
                    hasError && 'border-destructive focus-within:ring-destructive',
                    disabled && 'pointer-events-none opacity-50',
                    config.className
                )}
            >
                <Toolbar
                    editor={editor}
                    isFeatureAllowed={isFeatureAllowed}
                />
                <EditorContent editor={editor} />
            </div>
        </FieldWrapper>
    );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

interface ToolbarProps {
    readonly editor: NonNullable<ReturnType<typeof useEditor>>;
    readonly isFeatureAllowed: (feature: RichTextFeatureEnum) => boolean;
}

function Toolbar({ editor, isFeatureAllowed }: ToolbarProps) {
    const promptForLink = () => {
        const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
        const url = window.prompt('URL del enlace', previous);
        if (url === null) return; // cancelled
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div
            role="toolbar"
            aria-label="Formato"
            className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-1.5"
        >
            {isFeatureAllowed(RichTextFeatureEnum.BOLD) && (
                <ToolbarButton
                    label="Negrita"
                    icon={BoldIcon}
                    isActive={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                />
            )}
            {isFeatureAllowed(RichTextFeatureEnum.ITALIC) && (
                <ToolbarButton
                    label="Cursiva"
                    icon={ItalicIcon}
                    isActive={editor.isActive('italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                />
            )}
            {isFeatureAllowed(RichTextFeatureEnum.UNDERLINE) && (
                <ToolbarButton
                    label="Subrayado"
                    icon={UnderlineIcon}
                    isActive={editor.isActive('underline')}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                />
            )}
            {isFeatureAllowed(RichTextFeatureEnum.HEADING) && (
                <>
                    <ToolbarTextButton
                        label="Encabezado 2"
                        text="H2"
                        isActive={editor.isActive('heading', { level: 2 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    />
                    <ToolbarTextButton
                        label="Encabezado 3"
                        text="H3"
                        isActive={editor.isActive('heading', { level: 3 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    />
                </>
            )}
            {isFeatureAllowed(RichTextFeatureEnum.LIST) && (
                <ToolbarButton
                    label="Lista"
                    icon={ListIcon}
                    isActive={editor.isActive('bulletList')}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                />
            )}
            {isFeatureAllowed(RichTextFeatureEnum.ORDERED_LIST) && (
                <ToolbarButton
                    label="Lista numerada"
                    icon={ListOrderedIcon}
                    isActive={editor.isActive('orderedList')}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                />
            )}
            {isFeatureAllowed(RichTextFeatureEnum.QUOTE) && (
                <ToolbarButton
                    label="Cita"
                    icon={QuotesIcon}
                    isActive={editor.isActive('blockquote')}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                />
            )}
            {isFeatureAllowed(RichTextFeatureEnum.LINK) && (
                <ToolbarButton
                    label="Enlace"
                    icon={LinkIcon}
                    isActive={editor.isActive('link')}
                    onClick={promptForLink}
                />
            )}
        </div>
    );
}

interface ToolbarButtonProps {
    readonly label: string;
    readonly icon: React.ComponentType<{ className?: string }>;
    readonly isActive: boolean;
    readonly onClick: () => void;
}

function ToolbarButton({ label, icon: Icon, isActive, onClick }: ToolbarButtonProps) {
    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // keep editor focus
            onClick={onClick}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded',
                'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive && 'bg-accent text-accent-foreground'
            )}
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}

interface ToolbarTextButtonProps {
    readonly label: string;
    readonly text: string;
    readonly isActive: boolean;
    readonly onClick: () => void;
}

function ToolbarTextButton({ label, text, isActive, onClick }: ToolbarTextButtonProps) {
    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={cn(
                'inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-xs',
                'font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive && 'bg-accent text-accent-foreground'
            )}
        >
            {text}
        </button>
    );
}
