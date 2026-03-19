/**
 * Re-export shim for backward compatibility.
 * The canonical source has moved to @repo/utils.
 *
 * @module services/feedback/markdown-helpers
 * @deprecated Import from '@repo/utils' instead.
 */
export {
    ALLOWED_UPLOAD_HOST_PATTERN,
    escapeMarkdown,
    sanitizeConsoleError,
    truncateStack
} from '@repo/utils';
