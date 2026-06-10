/**
 * @file RichTextEditor.client.tsx
 * @description TipTap WYSIWYG editor for the web app, persisting content as Markdown.
 *
 * Adapted from admin's RichTextField with simplified props for the web
 * accommodation editor. Uses TipTap StarterKit (h2/h3), Underline, Link,
 * and Markdown extensions.
 *
 * SSR safety: This component MUST be rendered with `client:only="react"` or
 * wrapped in `React.lazy` because TipTap accesses `window` during init.
 *
 * @module components/host/editor/RichTextEditor
 */

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
import { useCallback, useEffect } from 'react';
import { Markdown } from 'tiptap-markdown';
import styles from './RichTextEditor.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RichTextEditorProps {
    /** Current Markdown value */
    readonly value: string;
    /** Change handler — emits a Markdown string */
    readonly onChange: (value: string) => void;
    /** Placeholder text shown when editor is empty */
    readonly placeholder?: string;
    /** Whether the editor is disabled */
    readonly disabled?: boolean;
    /** Whether the field has a validation error */
    readonly hasError?: boolean;
    /** Error message to display */
    readonly errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RichTextEditor — TipTap WYSIWYG editor persisting content as Markdown.
 *
 * @example
 * ```tsx
 * // In an Astro page — MUST use client:only="react" for SSR safety:
 * <RichTextEditorClient
 *   value={formData.description}
 *   onChange={(md) => handleFieldChange('description', md)}
 *   placeholder="Describí tu propiedad..."
 *   client:only="react"
 * />
 * ```
 */
export function RichTextEditor({
    value = '',
    onChange,
    placeholder,
    disabled = false,
    hasError = false,
    errorMessage
}: RichTextEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        editable: !disabled,
        content: value,
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] }
            }),
            Underline,
            Link.configure({
                openOnClick: false
            }),
            Markdown.configure({
                html: false,
                linkify: true,
                breaks: false,
                transformPastedText: true
            })
        ],
        editorProps: {
            attributes: {
                role: 'textbox',
                'aria-multiline': 'true',
                'aria-invalid': hasError ? 'true' : 'false',
                class: styles.editorContent
            }
        },
        onUpdate({ editor: ed }) {
            const md = ed.storage.markdown?.getMarkdown?.() ?? '';
            onChange(md);
        }
    });

    // Keep the editor in sync when the controlled `value` changes externally
    useEffect(() => {
        if (!editor) return;
        const currentMd: string = editor.storage.markdown?.getMarkdown?.() ?? '';
        if ((value ?? '') !== currentMd) {
            editor.commands.setContent(value ?? '', false);
        }
    }, [editor, value]);

    // Toggle editor.editable when `disabled` flips after mount
    useEffect(() => {
        if (!editor) return;
        editor.setEditable(!disabled);
    }, [editor, disabled]);

    // Loading placeholder while editor initializes
    if (!editor) {
        return (
            <div
                className={`${styles.wrapper} ${hasError ? styles.wrapperError : ''}`}
                aria-busy="true"
            >
                <div className={styles.placeholder}>{placeholder ?? ''}</div>
            </div>
        );
    }

    return (
        <div
            className={`${styles.wrapper} ${hasError ? styles.wrapperError : ''} ${disabled ? styles.disabled : ''}`}
        >
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
            {placeholder && editor.isEmpty && (
                <div className={styles.placeholderOverlay}>{placeholder}</div>
            )}
            {hasError && errorMessage && (
                <div
                    className={styles.errorMessage}
                    role="alert"
                >
                    {errorMessage}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

interface ToolbarProps {
    readonly editor: NonNullable<ReturnType<typeof useEditor>>;
}

function Toolbar({ editor }: ToolbarProps) {
    const promptForLink = useCallback(() => {
        const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
        const url = window.prompt('URL del enlace', previous);
        if (url === null) return; // cancelled
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    return (
        <div
            role="toolbar"
            aria-label="Formato"
            className={styles.toolbar}
        >
            <ToolbarButton
                label="Negrita"
                icon={BoldIcon}
                isActive={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
                label="Cursiva"
                icon={ItalicIcon}
                isActive={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
                label="Subrayado"
                icon={UnderlineIcon}
                isActive={editor.isActive('underline')}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
            />
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
            <ToolbarButton
                label="Lista"
                icon={ListIcon}
                isActive={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
                label="Lista numerada"
                icon={ListOrderedIcon}
                isActive={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
                label="Cita"
                icon={QuotesIcon}
                isActive={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
            <ToolbarButton
                label="Enlace"
                icon={LinkIcon}
                isActive={editor.isActive('link')}
                onClick={promptForLink}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Toolbar sub-components
// ---------------------------------------------------------------------------

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
            className={`${styles.toolbarButton} ${isActive ? styles.toolbarButtonActive : ''}`}
        >
            <Icon className={styles.toolbarIcon} />
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
            className={`${styles.toolbarTextButton} ${isActive ? styles.toolbarButtonActive : ''}`}
        >
            {text}
        </button>
    );
}
