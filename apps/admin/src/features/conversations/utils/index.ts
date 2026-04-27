/**
 * Utility functions for the conversations feature.
 *
 * Provides timestamp formatters, text helpers, and
 * i18n label mappings for sender types.
 */

import type { SenderType } from '../types';

/**
 * Format an ISO timestamp as a relative string (e.g. "hace 5 minutos").
 * Falls back to the absolute formatted date when the date is too old.
 *
 * @param iso - ISO 8601 timestamp string
 * @param locale - BCP 47 locale tag (default: 'es')
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(iso: string, locale = 'es'): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (typeof Intl === 'undefined' || typeof Intl.RelativeTimeFormat === 'undefined') {
        return formatAbsoluteTime(iso, locale);
    }

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (diffSec < 60) return rtf.format(-diffSec, 'second');
    if (diffMin < 60) return rtf.format(-diffMin, 'minute');
    if (diffHour < 24) return rtf.format(-diffHour, 'hour');
    if (diffDay < 7) return rtf.format(-diffDay, 'day');

    return formatAbsoluteTime(iso, locale);
}

/**
 * Format an ISO timestamp as an absolute human-readable string.
 *
 * @param iso - ISO 8601 timestamp string
 * @param locale - BCP 47 locale tag (default: 'es')
 * @returns Formatted date string
 */
export function formatAbsoluteTime(iso: string, locale = 'es'): string {
    const date = new Date(iso);
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

/**
 * Truncate a string to a maximum number of characters, appending ellipsis.
 *
 * @param text - Source text
 * @param maxLength - Maximum length before truncation (default: 200)
 * @returns Truncated string
 */
export function excerptTruncate(text: string, maxLength = 200): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trimEnd()}...`;
}

/**
 * Map a SenderType value to its corresponding i18n key.
 *
 * @param senderType - The sender type enum value
 * @returns i18n key path under the conversations namespace
 */
export function senderTypeToI18nKey(senderType: SenderType): string {
    const map: Record<SenderType, string> = {
        GUEST: 'conversations.senderLabels.guest',
        OWNER: 'conversations.senderLabels.owner',
        SYSTEM: 'conversations.thread.systemMessage'
    };
    return map[senderType];
}

/** A plain text segment in a parsed message body */
export interface TextSegment {
    type: 'text';
    value: string;
}

/** A URL link segment extracted from message text */
export interface LinkSegment {
    type: 'link';
    href: string;
    value: string;
}

/** Union of parsed content segment types */
export type ParsedSegment = TextSegment | LinkSegment;

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

/**
 * Parse plain text into segments, separating plain text from HTTP/HTTPS URLs.
 * Never uses dangerouslySetInnerHTML — callers render segments as React elements.
 *
 * @param text - Input plain text string
 * @returns Array of ParsedSegment items
 */
export function parseTextSegments(text: string): ParsedSegment[] {
    const segments: ParsedSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(URL_PATTERN.source, 'g');

    match = re.exec(text);
    while (match !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        segments.push({ type: 'link', href: match[0], value: match[0] });
        lastIndex = match.index + match[0].length;
        match = re.exec(text);
    }

    if (lastIndex < text.length) {
        segments.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return segments;
}
