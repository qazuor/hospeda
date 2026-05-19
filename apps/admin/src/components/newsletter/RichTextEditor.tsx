/**
 * @file RichTextEditor component
 *
 * A controlled rich-text editor for newsletter campaign body content.
 * Built on TipTap v2 with StarterKit + Image + Link + Underline + TextAlign
 * extensions. Emits TipTap JSON documents on change (debounced at 200 ms).
 *
 * Re-exports `TiptapDocument` from `@repo/utils` so consumers can use a single
 * import path for both the component and the document type.
 *
 * @module RichTextEditor
 */

import { cn } from '@/lib/utils';
import type { TiptapDocument } from '@repo/utils';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor, JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useRef } from 'react';

// Re-export so pages can `import { type TiptapDocument } from '@/components/newsletter/RichTextEditor'`
export type { TiptapDocument };

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Props for the RichTextEditor component.
 */
export interface RichTextEditorProps {
    /** Current value as a TipTap JSON document. `null` means "empty". */
    readonly value: TiptapDocument | null;
    /** Called whenever the editor content changes (debounced at 200 ms). */
    readonly onChange: (next: TiptapDocument) => void;
    /** Disables every interaction (read-only mode). */
    readonly disabled?: boolean;
    /** Optional id wired to the inner editor region for label association. */
    readonly id?: string;
    /** ARIA label for the editor region. */
    readonly ariaLabel?: string;
    /**
     * Optional className passed through to the outer wrapper so the page can
     * apply its own border / spacing tokens.
     */
    readonly className?: string;
}

// ─── Toolbar separator ────────────────────────────────────────────────────────

function ToolbarSeparator() {
    return (
        <div
            className="mx-1 h-5 w-px bg-border"
            aria-hidden="true"
        />
    );
}

// ─── Single toolbar button ────────────────────────────────────────────────────

interface ToolbarButtonProps {
    readonly onClick: () => void;
    readonly title: string;
    readonly isActive?: boolean;
    readonly isDisabled: boolean;
    readonly children: React.ReactNode;
    /** Whether this button represents a toggleable state (adds aria-pressed). */
    readonly toggleable?: boolean;
}

function ToolbarButton({
    onClick,
    title,
    isActive = false,
    isDisabled,
    children,
    toggleable = false
}: ToolbarButtonProps) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={isDisabled}
            aria-pressed={toggleable ? isActive : undefined}
            className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'disabled:pointer-events-none disabled:opacity-40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive && 'bg-accent font-semibold text-accent-foreground'
            )}
        >
            {children}
        </button>
    );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

interface ToolbarProps {
    readonly editor: Editor;
    readonly disabled: boolean;
}

/**
 * Renders the formatting toolbar with all 15 actions defined in UX §5.6.
 * Uses plain-text labels because lucide-react is not installed in apps/admin.
 */
function Toolbar({ editor, disabled }: ToolbarProps) {
    const dis = (can: boolean) => disabled || !can;

    const handleLinkClick = useCallback(() => {
        if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
            return;
        }
        // eslint-disable-next-line no-alert
        const url = window.prompt('URL del enlace');
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    }, [editor]);

    return (
        <div
            role="toolbar"
            aria-label="Editor toolbar"
            className="flex flex-wrap items-center gap-0.5 border-border border-b bg-muted/30 px-2 py-1"
        >
            {/* 1. Bold */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Negrita (Ctrl+B)"
                isActive={editor.isActive('bold')}
                isDisabled={dis(editor.can().toggleBold())}
                toggleable
            >
                <span className="font-bold">B</span>
            </ToolbarButton>

            {/* 2. Italic */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Cursiva (Ctrl+I)"
                isActive={editor.isActive('italic')}
                isDisabled={dis(editor.can().toggleItalic())}
                toggleable
            >
                <span className="italic">I</span>
            </ToolbarButton>

            {/* 3. Underline */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                title="Subrayado (Ctrl+U)"
                isActive={editor.isActive('underline')}
                isDisabled={dis(editor.can().toggleUnderline())}
                toggleable
            >
                <span className="underline">U</span>
            </ToolbarButton>

            <ToolbarSeparator />

            {/* 5. H2 */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Título H2"
                isActive={editor.isActive('heading', { level: 2 })}
                isDisabled={dis(editor.can().toggleHeading({ level: 2 }))}
                toggleable
            >
                H2
            </ToolbarButton>

            {/* 6. H3 */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                title="Título H3"
                isActive={editor.isActive('heading', { level: 3 })}
                isDisabled={dis(editor.can().toggleHeading({ level: 3 }))}
                toggleable
            >
                H3
            </ToolbarButton>

            <ToolbarSeparator />

            {/* 8. Bullet list */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Lista con viñetas"
                isActive={editor.isActive('bulletList')}
                isDisabled={dis(editor.can().toggleBulletList())}
                toggleable
            >
                {'•—'}
            </ToolbarButton>

            {/* 9. Ordered list */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Lista numerada"
                isActive={editor.isActive('orderedList')}
                isDisabled={dis(editor.can().toggleOrderedList())}
                toggleable
            >
                {'1.'}
            </ToolbarButton>

            {/* 10. Blockquote */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Cita"
                isActive={editor.isActive('blockquote')}
                isDisabled={dis(editor.can().toggleBlockquote())}
                toggleable
            >
                {'❝'}
            </ToolbarButton>

            <ToolbarSeparator />

            {/* 12. Link */}
            <ToolbarButton
                onClick={handleLinkClick}
                title="Enlace"
                isActive={editor.isActive('link')}
                isDisabled={disabled}
                toggleable
            >
                {'🔗'}
            </ToolbarButton>

            {/* 13. Horizontal Rule (Divider) */}
            <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Divisor horizontal"
                isActive={false}
                isDisabled={dis(editor.can().setHorizontalRule())}
            >
                {'─'}
            </ToolbarButton>

            <ToolbarSeparator />

            {/* 15. Clear formatting */}
            <ToolbarButton
                onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                title="Limpiar formato"
                isActive={false}
                isDisabled={disabled}
            >
                {'T̶'}
            </ToolbarButton>
        </div>
    );
}

// ─── RichTextEditor ───────────────────────────────────────────────────────────

/**
 * Controlled rich-text editor for newsletter campaign body content.
 *
 * Accepts and emits TipTap JSON documents. Syncs external `value` changes into
 * the editor without triggering a re-emit (avoids feedback loops). Debounces
 * onChange at 200 ms to limit upstream re-renders during typing.
 *
 * @param props - RichTextEditorProps
 *
 * @example
 * ```tsx
 * const [body, setBody] = useState<TiptapDocument | null>(null);
 *
 * <RichTextEditor
 *   value={body}
 *   onChange={setBody}
 *   ariaLabel="Contenido del email"
 * />
 * ```
 */
export function RichTextEditor({
    value,
    onChange,
    disabled = false,
    id,
    ariaLabel,
    className
}: RichTextEditorProps) {
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({ openOnClick: false }),
            Image,
            TextAlign.configure({ types: ['heading', 'paragraph'] })
        ],
        // Cast is safe: TiptapDocument is structurally compatible with JSONContent
        content: (value as JSONContent) ?? undefined,
        editable: !disabled,
        editorProps: {
            attributes: {
                // role="textbox" + aria-multiline make aria-label a permitted
                // ARIA attribute on the div (axe aria-prohibited-attr otherwise
                // rejects it because <div> has no implicit role accepting it).
                role: 'textbox',
                'aria-multiline': 'true',
                'aria-label': ariaLabel ?? 'Editor de contenido',
                ...(id ? { id } : {})
            }
        },
        onUpdate: ({ editor: ed }) => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
            debounceTimer.current = setTimeout(() => {
                onChange(ed.getJSON() as TiptapDocument);
            }, 200);
        }
    });

    // Sync external value changes into the editor without re-emitting onChange.
    useEffect(() => {
        if (!editor) return;

        const current = JSON.stringify(editor.getJSON());
        const incoming = JSON.stringify(value ?? null);

        if (current !== incoming) {
            // Cast is safe: TiptapDocument is structurally compatible with JSONContent
            editor.commands.setContent((value as JSONContent) ?? null, false);
        }
    }, [editor, value]);

    // Sync disabled state.
    useEffect(() => {
        if (!editor) return;
        editor.setEditable(!disabled);
    }, [editor, disabled]);

    // Cleanup debounce timer on unmount.
    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, []);

    return (
        <div
            className={cn('flex flex-col rounded-md border border-input bg-background', className)}
        >
            {editor && (
                <Toolbar
                    editor={editor}
                    disabled={disabled}
                />
            )}

            {/*
             * EditorContent renders the ProseMirror div which already carries
             * role="textbox" and aria-multiline="true". We pass aria-label via
             * editorProps.attributes in useEditor so the ProseMirror div is the
             * accessible labelled textbox — no extra wrapper div needed.
             */}
            <EditorContent
                editor={editor}
                className={cn(
                    'prose prose-sm max-w-none flex-1 px-4 py-3',
                    'focus-within:outline-none',
                    '[&_.ProseMirror]:min-h-[200px]',
                    '[&_.ProseMirror]:outline-none',
                    '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
                    '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
                    '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
                    '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
                    '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
                    disabled && 'cursor-not-allowed opacity-60'
                )}
            />
        </div>
    );
}
