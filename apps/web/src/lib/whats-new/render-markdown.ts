/**
 * @file render-markdown.ts
 * @description Lightweight markdown-to-HTML converter for What's New entries.
 *
 * Supports a safe subset of markdown (bold, italic, links, headers, lists,
 * paragraphs). Output is sanitised to strip script/event-handler attributes.
 *
 * The source markdown originates from the curated whats-new.ts data file,
 * not from user input, but we sanitise defensively regardless.
 */

const HTML_ESCAPE_RE = /[&<>"']/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

function escapeHtml(text: string): string {
    return text.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

function sanitiseHtml(html: string): string {
    return html
        .replace(/<script[\s>]/gi, '&lt;script')
        .replace(/<\/script>/gi, '&lt;/script')
        .replace(/<iframe[\s>]/gi, '&lt;iframe')
        .replace(/<\/iframe>/gi, '&lt;/iframe')
        .replace(/<object[\s>]/gi, '&lt;object')
        .replace(/<\/object>/gi, '&lt;/object')
        .replace(/<embed[\s>]/gi, '&lt;embed')
        .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/javascript\s*:/gi, 'blocked:');
}

/**
 * Converts a markdown string to sanitised HTML.
 *
 * Supports: paragraphs, bold, italic, inline code, links, h1-h6,
 * unordered lists, ordered lists, horizontal rules, and line breaks.
 *
 * @param markdown - Raw markdown body string from a `WhatsNewItem`.
 * @returns Sanitised HTML string. Falls back to escaped plain text on error.
 */
export function renderMarkdownToHtml(markdown: string): string {
    if (!markdown) return '';

    try {
        const lines = markdown.split('\n');
        const htmlParts: string[] = [];
        let inList: 'ul' | 'ol' | null = null;

        function closeList(): void {
            if (inList) {
                htmlParts.push(`</${inList}>`);
                inList = null;
            }
        }

        for (const rawLine of lines) {
            const line = rawLine;

            const ulMatch = line.match(/^[-*+]\s+(.*)$/);
            const olMatch = line.match(/^\d+[.)]\s+(.*)$/);

            if (ulMatch) {
                if (inList !== 'ul') {
                    closeList();
                    htmlParts.push('<ul>');
                    inList = 'ul';
                }
                htmlParts.push(`<li>${inlineMarkdown(ulMatch[1])}</li>`);
                continue;
            }

            if (olMatch) {
                if (inList !== 'ol') {
                    closeList();
                    htmlParts.push('<ol>');
                    inList = 'ol';
                }
                htmlParts.push(`<li>${inlineMarkdown(olMatch[1])}</li>`);
                continue;
            }

            closeList();

            const trimmed = line.trim();

            if (trimmed === '') {
                htmlParts.push('');
                continue;
            }

            if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
                htmlParts.push('<hr />');
                continue;
            }

            const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (hMatch) {
                const level = hMatch[1].length;
                htmlParts.push(`<h${level}>${inlineMarkdown(hMatch[2])}</h${level}>`);
                continue;
            }

            htmlParts.push(`<p>${inlineMarkdown(trimmed)}</p>`);
        }

        closeList();

        const raw = htmlParts.join('\n');
        return sanitiseHtml(raw);
    } catch {
        return `<p>${escapeHtml(markdown)}</p>`;
    }
}

function inlineMarkdown(text: string): string {
    let result = escapeHtml(text);

    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText: string, url: string) => {
        const safeUrl =
            url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')
                ? url.replace(/[^\w:/?#[\]@!$&'()*+,;=.\-]/g, '')
                : '#';
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });

    result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');

    result = result.replace(/ {2}\n/g, '<br />');

    return result;
}
