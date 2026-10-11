import type { MaskedSource } from './payments-guard-scan.js';

/** The only source files whose provider-notification writes are permitted by G17(c). */
export const NOTIFICATION_WRITER_FILES = Object.freeze([
    'packages/db/src/schemas/vertical/provider-notification.dbschema.ts',
    'packages/db/src/models/provider-notification/provider-notification.model.ts'
] as const);

const TABLE_SNAKE = ['provider', 'notification'].join('_');
const TABLE_CAMEL = ['provider', 'Notification'].join('');
const TABLE_MENTION = new RegExp(`\\b(?:${TABLE_SNAKE}|${TABLE_CAMEL})s?\\b`, 'g');

/**
 * Returns table mentions that are not schema declarations, imports/exports,
 * insert/delete targets, or Drizzle inferred row types. This is a read-only
 * lexical check for GUARD:G17(c), not a SQL or TypeScript parser.
 *
 * @param args.file - Repo-relative source path
 * @param args.masked - Source returned by `maskSource`
 * @returns Forbidden table mention offsets and matched text
 */
export function findForbiddenNotificationMentions({
    file,
    masked
}: {
    readonly file: string;
    readonly masked: MaskedSource;
}): readonly { readonly offset: number; readonly mention: string }[] {
    const found: { offset: number; mention: string }[] = [];
    if (!(NOTIFICATION_WRITER_FILES as readonly string[]).includes(file)) {
        for (const match of masked.code.matchAll(TABLE_MENTION))
            found.push({ offset: match.index, mention: match[0] });
        for (const literal of masked.strings)
            if (new RegExp(`\\b${TABLE_SNAKE}\\b`).test(literal.value))
                found.push({ offset: literal.start, mention: TABLE_SNAKE });
        return found.sort((a, b) => a.offset - b.offset);
    }
    for (const match of masked.code.matchAll(TABLE_MENTION)) {
        const offset = match.index;
        const mention = match[0];
        if (isAllowedCodeMention({ code: masked.code, offset, mention })) continue;
        found.push({ offset, mention });
    }
    for (const literal of masked.strings) {
        if (!new RegExp(`\\b${TABLE_SNAKE}\\b`).test(literal.value)) continue;
        const before = masked.code.slice(Math.max(0, literal.start - 80), literal.start);
        if (/pgTable\s*\(\s*$/.test(before)) continue;
        found.push({ offset: literal.start, mention: TABLE_SNAKE });
    }
    return found.sort((a, b) => a.offset - b.offset);
}

function isAllowedCodeMention({
    code,
    offset,
    mention
}: {
    readonly code: string;
    readonly offset: number;
    readonly mention: string;
}): boolean {
    const before = code.slice(Math.max(0, offset - 300), offset);
    const after = code.slice(offset + mention.length, offset + mention.length + 100);
    const declaration = /\bpgTable\s*\(\s*['"]?$/;
    if (mention === TABLE_SNAKE && declaration.test(before)) return true;
    if (
        new RegExp(`\\btypeof\\s+${TABLE_CAMEL}s?\\s*\\.\\s*\\$infer(?:Insert|Select)\\b`).test(
            code.slice(Math.max(0, offset - 40), offset + mention.length + 40)
        )
    )
        return true;
    if (mention === TABLE_CAMEL || mention === `${TABLE_CAMEL}s`) {
        const statementStart = code.lastIndexOf(';', offset) + 1;
        const statement = code.slice(statementStart, offset);
        if (
            new RegExp(`^\\s*export\\s+(?:const|let|var)\\s+${TABLE_CAMEL}s?\\b`).test(
                statement + mention
            )
        )
            return true;
        if (/^\s*import\b/.test(statement) || /^\s*export\s*\{/.test(statement)) return true;
        if (/\.\s*(?:insert|delete)\s*\(\s*$/.test(before) && /^\s*[),]/.test(after)) return true;
    }
    return false;
}
