import { toSlug } from '@repo/utils';

export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trimEnd()}...`;
}

export function slugify(text: string): string {
    return toSlug(text);
}
