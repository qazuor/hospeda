/**
 * @file RichTextEditor.client.tsx
 * @description TipTap WYSIWYG editor for the web app, persisting content as Markdown.
 *
 * Adapted from admin's RichTextField with simplified props for the web
 * accommodation editor. Uses TipTap v3 StarterKit (h2/h3, with Underline and
 * Link bundled) and the Markdown extension.
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
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useRef } from 'react';
import { Markdown } from 'tiptap-markdown';
import styles from './RichTextEditor.module.css';

/**
 * Reads the Markdown serialization from a TipTap editor.
 *
 * `tiptap-markdown@0.9.0` ships no Tiptap v3 `Storage` type augmentation, so
 * `editor.storage.markdown` is untyped under v3. Narrow it here (once) instead
 * of casting at every call site. Exported so the compatibility test reads the
 * value the same way the component does.
 */
export function readMarkdown(editor: { storage: unknown }): string {
    const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
    return storage.markdown?.getMarkdown?.() ?? '';
}

/**
 * TipTap extension set for the web host editor.
 *
 * Exported so the v3 compatibility test mounts the exact configuration the
 * component ships. v3 bundles Link and Underline into StarterKit; the bundled
 * Link keeps the previous `openOnClick: false` behavior.
 */
export const HOST_EDITOR_EXTENSIONS = [
    StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
            openOnClick: false
        }
    }),
    Markdown.configure({
        html: false,
        linkify: true,
        breaks: false,
        transformPastedText: true
    })
];

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
    /**
     * Accessible name for the editing surface (HOS-371).
     *
     * The editable region is a contenteditable `<div role="textbox">`, NOT a
     * form control, so an external `<label htmlFor>` cannot name it — a label
     * sitting above this editor is decorative to assistive tech. Callers that
     * replace a labelled `<textarea>` with this component MUST pass this, or
     * the field silently loses its accessible name.
     */
    readonly ariaLabel?: string;
    /**
     * DOM id for the editing surface (HOS-373).
     *
     * Lets the field-to-input-id contract point at this editor the same way it
     * points at a plain `<textarea>`, so "focus the first invalid field" works
     * whether the rich or fallback branch rendered. Without it the contenteditable
     * has no id at all and focus silently does nothing.
     */
    readonly id?: string;
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
    errorMessage,
    ariaLabel,
    id
}: RichTextEditorProps) {
    /**
     * Latest controlled `value`, read inside `onUpdate` (HOS-371).
     *
     * A ref rather than the prop directly: `useEditor`'s `onUpdate` closure is
     * created once, so reading `value` from it would pin the mount-time string
     * forever and the guard below would compare against a stale baseline after
     * the first keystroke.
     */
    const valueRef = useRef(value);
    valueRef.current = value;

    const editor = useEditor({
        immediatelyRender: false,
        editable: !disabled,
        content: value,
        extensions: HOST_EDITOR_EXTENSIONS,
        editorProps: {
            attributes: {
                role: 'textbox',
                'aria-multiline': 'true',
                'aria-invalid': hasError ? 'true' : 'false',
                ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
                ...(id ? { id } : {}),
                class: styles.editorContent
            }
        },
        onUpdate({ editor: ed }) {
            const md = readMarkdown(ed);
            // Defence in depth: a controlled component must not report a change
            // it did not receive. The `setEditable` fix below removes the one
            // source that actually fired this on mount, but any future emit
            // that serializes back to the value we already hold is equally not
            // an edit, and a parent that dirty-tracks per field (the commerce
            // owner editor, HOS-371) would flag the field dirty from it.
            if (md === (valueRef.current ?? '')) {
                return;
            }
            onChange(md);
        }
    });

    // Keep the editor in sync when the controlled `value` changes externally
    // (e.g. the owner accepts an AiTextImprovePanel suggestion, which writes
    // straight to the parent's field). `emitUpdate: false` is honoured here —
    // this does NOT report back as an edit.
    useEffect(() => {
        if (!editor) return;
        const currentMd: string = readMarkdown(editor);
        if ((value ?? '') !== currentMd) {
            editor.commands.setContent(value ?? '', { emitUpdate: false });
        }
    }, [editor, value]);

    // Toggle editor.editable when `disabled` flips after mount.
    //
    // The second argument is `emitUpdate` and defaults to TRUE, so the bare
    // `setEditable(!disabled)` this used to be fired a full content `onUpdate`
    // on every mount — for a change that touches only the editable flag and
    // never the document. That was the real source of the phantom edit: the
    // emit carried TipTap's NORMALIZED serialization of the stored Markdown,
    // which differs from the raw stored string whenever that string is not
    // already in TipTap's canonical form (`"a\nb"` serializes back as `"a b"`,
    // a trailing newline is stripped, runs of blank lines collapse). So the
    // equality guard in `onUpdate` did not catch it, and any parent that
    // dirty-tracks per field (the commerce owner editor, HOS-371) saw the field
    // go dirty on load — Save enabled with zero edits, and the stored Markdown
    // silently re-flowed on the next save of an unrelated field.
    useEffect(() => {
        if (!editor) return;
        editor.setEditable(!disabled, false);
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
