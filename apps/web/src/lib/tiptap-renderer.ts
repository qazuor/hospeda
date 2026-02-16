/**
 * TipTap/ProseMirror JSON to HTML renderer
 *
 * Converts TipTap document JSON structure to safe HTML strings.
 * Supports common rich text nodes (headings, lists, blockquotes, code blocks)
 * and inline marks (bold, italic, links, code, underline).
 *
 * @module tiptap-renderer
 */

/**
 * Represents an inline mark (formatting) applied to text.
 */
export interface TiptapMark {
    readonly type: 'bold' | 'italic' | 'link' | 'code' | 'underline';
    readonly attrs?: Record<string, string>;
}

/**
 * Represents a node in the TipTap document tree.
 */
export interface TiptapNode {
    readonly type: string;
    readonly content?: ReadonlyArray<TiptapNode>;
    readonly text?: string;
    readonly marks?: ReadonlyArray<TiptapMark>;
    readonly attrs?: Record<string, string | number>;
}

/**
 * Represents the root document node.
 */
export interface TiptapDocument {
    readonly type: 'doc';
    readonly content: ReadonlyArray<TiptapNode>;
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * @param text - Text to escape
 * @returns HTML-safe escaped text
 */
function escapeHtml({ text }: { text: string }): string {
    const replacements: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    return text.replace(/[&<>"']/g, (char) => replacements[char] || char);
}

/**
 * Wraps text with HTML tags for a single mark.
 *
 * @param mark - Mark to render
 * @param content - Inner HTML content
 * @returns HTML string with mark applied
 */
function renderMark({
    mark,
    content
}: {
    mark: TiptapMark;
    content: string;
}): string {
    switch (mark.type) {
        case 'bold':
            return `<strong>${content}</strong>`;
        case 'italic':
            return `<em>${content}</em>`;
        case 'underline':
            return `<u>${content}</u>`;
        case 'code':
            return `<code>${content}</code>`;
        case 'link': {
            const href = mark.attrs?.href ? escapeHtml({ text: mark.attrs.href }) : '';
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${content}</a>`;
        }
        default:
            return content;
    }
}

/**
 * Applies all marks to text content recursively.
 *
 * Marks are applied in reverse order so that the first mark in the array
 * becomes the outermost wrapper (e.g., [bold, italic] -> <strong><em>text</em></strong>).
 *
 * @param marks - Array of marks to apply
 * @param text - Text content to wrap
 * @returns HTML string with all marks applied
 */
function applyMarks({
    marks,
    text
}: {
    marks: ReadonlyArray<TiptapMark>;
    text: string;
}): string {
    return [...marks].reverse().reduce((content, mark) => renderMark({ mark, content }), text);
}

/**
 * Renders a single TipTap node to HTML.
 *
 * @param node - Node to render
 * @returns HTML string representation of the node
 */
function renderNode({ node }: { node: TiptapNode }): string {
    // Handle text nodes with marks
    if (node.type === 'text') {
        const escapedText = escapeHtml({ text: node.text || '' });
        if (node.marks && node.marks.length > 0) {
            return applyMarks({ marks: node.marks, text: escapedText });
        }
        return escapedText;
    }

    // Render children if present
    const children = node.content
        ? node.content.map((child) => renderNode({ node: child })).join('')
        : '';

    // Handle block and inline nodes
    switch (node.type) {
        case 'paragraph':
            return `<p>${children}</p>`;

        case 'heading': {
            const level = node.attrs?.level ?? 1;
            const tag = `h${Math.max(1, Math.min(6, Number(level)))}`;
            return `<${tag}>${children}</${tag}>`;
        }

        case 'blockquote':
            return `<blockquote>${children}</blockquote>`;

        case 'codeBlock':
            return `<pre><code>${children}</code></pre>`;

        case 'bulletList':
            return `<ul>${children}</ul>`;

        case 'orderedList':
            return `<ol>${children}</ol>`;

        case 'listItem':
            return `<li>${children}</li>`;

        case 'hardBreak':
            return '<br />';

        case 'image': {
            const src = node.attrs?.src ? escapeHtml({ text: String(node.attrs.src) }) : '';
            const alt = node.attrs?.alt ? escapeHtml({ text: String(node.attrs.alt) }) : '';
            return `<img src="${src}" alt="${alt}" />`;
        }

        default:
            // Unknown node types are rendered as their children
            return children;
    }
}

/**
 * Renders a TipTap document to HTML.
 *
 * Converts a TipTap/ProseMirror JSON document structure into a safe HTML string.
 * All text content is HTML-escaped to prevent XSS attacks.
 *
 * @param params - Parameters object
 * @param params.content - TipTap document to render (null/undefined returns empty string)
 * @returns HTML string representation of the document
 *
 * @example
 * ```typescript
 * const doc = {
 *   type: 'doc',
 *   content: [
 *     {
 *       type: 'heading',
 *       attrs: { level: 1 },
 *       content: [{ type: 'text', text: 'Hello World' }]
 *     }
 *   ]
 * };
 *
 * const html = renderTiptapContent({ content: doc });
 * // Returns: '<h1>Hello World</h1>'
 * ```
 */
export function renderTiptapContent({
    content
}: {
    content: TiptapDocument | null | undefined;
}): string {
    if (!content || !content.content || content.content.length === 0) {
        return '';
    }

    return content.content.map((node) => renderNode({ node })).join('');
}
