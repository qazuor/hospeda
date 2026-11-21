/**
 * @file search.ts
 * @description Finds the help articles a free-text question is about
 * (HOS-2333, spec HOS-2335 §5.4): a normalized keyword match, no embeddings.
 * Moved here from `apps/api/src/mcp/tools/help/help-search.ts` (HOS-2410 §5.1)
 * so `get_help` and the web help search share one tokenizer and one ranking.
 *
 * The question is UNTRUSTED text (it comes from a model that may relay anything a
 * guest wrote). It is only ever compared against the catalog: it is never
 * returned, logged or placed in a link, so there is nothing in it to inject.
 *
 * Scoring, per topic:
 * - each keyword whose words all appear in the question scores one point per
 *   word of the keyword, so a phrase outranks a single word;
 * - each distinct word of the question that is also a word of the title scores
 *   one point.
 *
 * A topic matches with one keyword hit, or with {@link HELP_MIN_TITLE_SCORE}
 * title words: a single title word is too common ("publicación") to mean
 * anything on its own. The best {@link HELP_MAX_TOPICS} win by total score; ties
 * keep the catalog order (the index sorts articles by id). Pure: the catalog is
 * an argument, and any object with the fields of {@link HelpSearchable} can be
 * searched.
 */

import type { HelpAudience } from './constants';

/** What the search reads of an article. */
export interface HelpSearchable {
    /** Stable id. */
    readonly id: string;
    /** Title, whose words score. */
    readonly title: string;
    /** Words and short phrases a question is matched against. */
    readonly keywords: readonly string[];
    /** Who the article is for. */
    readonly audiences: readonly HelpAudience[];
}

/** Most topics one answer carries. */
export const HELP_MAX_TOPICS = 3;

/** Fewest keyword points that make a topic match. */
export const HELP_MIN_KEYWORD_SCORE = 1;

/** Fewest title-word points that make a topic match when no keyword does. */
export const HELP_MIN_TITLE_SCORE = 2;

/** Words shorter than this are ignored in the question and in titles. */
const MIN_WORD_LENGTH = 3;

/** Shortest word whose prefix may stand for a longer form (`foto` for `fotos`). */
const MIN_STEM_LENGTH = 4;

/** Words that say nothing about the topic. Already normalized. */
const STOP_WORDS: ReadonlySet<string> = new Set([
    'como',
    'hago',
    'hacer',
    'puedo',
    'quiero',
    'para',
    'por',
    'que',
    'con',
    'una',
    'uno',
    'unos',
    'unas',
    'del',
    'las',
    'los',
    'mis',
    'mas',
    'cual',
    'donde',
    'cuando',
    'esta',
    'este',
    'esto',
    'sobre',
    'necesito',
    'ayuda',
    'hospeda'
]);

/**
 * Lowercases, strips accents and splits into words. Anything that is not a
 * letter or a digit separates words.
 *
 * @param args.text - Any text
 * @returns The normalized words
 */
export function tokenizeHelpText({ text }: { readonly text: string }): readonly string[] {
    return text
        .normalize('NFD')
        .replace(/\p{M}+/gu, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word !== '');
}

/**
 * The words of a text that say something: normalized, at least
 * `MIN_WORD_LENGTH` long and not a stop word. "de la" has none.
 *
 * @param args.text - Any text
 * @returns The normalized content words
 */
export function contentWordsOf({ text }: { readonly text: string }): readonly string[] {
    return tokenizeHelpText({ text }).filter(
        (word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word)
    );
}

/**
 * Whether two normalized words are the same word, or a stem and its longer form.
 * Stop words match only themselves.
 */
function wordsMatch({ a, b }: { readonly a: string; readonly b: string }): boolean {
    if (a === b) {
        return true;
    }
    // A stop word never stands for a longer word: "como" is not "comodidad".
    if (STOP_WORDS.has(a) || STOP_WORDS.has(b)) {
        return false;
    }
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
    return shorter.length >= MIN_STEM_LENGTH && longer.startsWith(shorter);
}

/** Whether the question has a word that matches `word`. */
function questionHasWord({
    questionWords,
    word
}: {
    readonly questionWords: readonly string[];
    readonly word: string;
}): boolean {
    return questionWords.some((candidate) => wordsMatch({ a: candidate, b: word }));
}

/** How well a topic fits a question: keyword points and title-word points. */
export interface HelpTopicScore {
    /** Points from the topic's keywords. */
    readonly keyword: number;
    /** Points from the words of the topic's title. */
    readonly title: number;
}

/**
 * Scores one topic against a question.
 *
 * @param args.questionWords - Every normalized word of the question (keywords may
 *   contain stop words, such as `no puedo publicar`)
 * @param args.topic - The topic
 * @returns The keyword and title points, `0` each when nothing matched
 */
export function scoreHelpTopic({
    questionWords,
    topic
}: {
    readonly questionWords: readonly string[];
    readonly topic: HelpSearchable;
}): HelpTopicScore {
    let keywordScore = 0;
    for (const keyword of topic.keywords) {
        const words = tokenizeHelpText({ text: keyword });
        if (words.length > 0 && words.every((word) => questionHasWord({ questionWords, word }))) {
            keywordScore += words.length;
        }
    }
    const titleWords = new Set(
        tokenizeHelpText({ text: topic.title }).filter(
            (word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word)
        )
    );
    const contentWords = questionWords.filter(
        (word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word)
    );
    let titleScore = 0;
    for (const questionWord of new Set(contentWords)) {
        for (const titleWord of titleWords) {
            if (wordsMatch({ a: questionWord, b: titleWord })) {
                titleScore += 1;
                break;
            }
        }
    }
    return { keyword: keywordScore, title: titleScore };
}

/** Whether a score is enough for the topic to count as a match. */
function isMatch({ score }: { readonly score: HelpTopicScore }): boolean {
    return score.keyword >= HELP_MIN_KEYWORD_SCORE || score.title >= HELP_MIN_TITLE_SCORE;
}

/**
 * Whether an article answers a caller of the given audience: its `audiences`
 * include it. No audience means every article.
 */
export function topicServesAudience({
    topic,
    audience
}: {
    readonly topic: HelpSearchable;
    readonly audience?: HelpAudience;
}): boolean {
    return audience === undefined || topic.audiences.includes(audience);
}

/** Arguments for {@link searchOwnerHelp}. RO-RO. */
export interface SearchOwnerHelpArgs<T extends HelpSearchable> {
    /** The catalog. */
    readonly topics: readonly T[];
    /** The free-text question. Untrusted: only compared, never returned. */
    readonly question: string;
    /** The kind of owner asking; omit for every article. */
    readonly audience?: HelpAudience;
    /**
     * Most topics returned. Defaults to {@link HELP_MAX_TOPICS}, what `get_help`
     * answers with; the web help search asks for more (HOS-2410 web-ui §3).
     */
    readonly limit?: number;
}

/**
 * The topics a question is about, best first.
 *
 * @param args - The catalog, the question, the optional audience and limit
 * @returns At most `limit` topics, empty when nothing matches
 *
 * @example
 * ```typescript
 * searchOwnerHelp({ topics: HELP_ARTICLES, question: 'cómo subo fotos' });
 * // [photos]
 * ```
 */
export function searchOwnerHelp<T extends HelpSearchable>({
    topics,
    question,
    audience,
    limit = HELP_MAX_TOPICS
}: SearchOwnerHelpArgs<T>): readonly T[] {
    const questionWords = tokenizeHelpText({ text: question });
    const hasContent = questionWords.some(
        (word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word)
    );
    if (!hasContent) {
        return [];
    }
    return topics
        .filter((topic) => topicServesAudience({ topic, audience }))
        .map((topic, order) => ({ topic, order, score: scoreHelpTopic({ questionWords, topic }) }))
        .filter((entry) => isMatch({ score: entry.score }))
        .sort(
            (x, y) =>
                y.score.keyword + y.score.title - (x.score.keyword + x.score.title) ||
                x.order - y.order
        )
        .slice(0, limit)
        .map((entry) => entry.topic);
}

/** Arguments for {@link findOwnerHelpTopic}. RO-RO. */
export interface FindOwnerHelpTopicArgs<T extends Pick<HelpSearchable, 'id'>> {
    /** The catalog. */
    readonly topics: readonly T[];
    /** The topic id. */
    readonly id: string;
}

/**
 * One topic by its id.
 *
 * @param args - The catalog and the id
 * @returns The topic, or `undefined` when there is none
 */
export function findOwnerHelpTopic<T extends Pick<HelpSearchable, 'id'>>({
    topics,
    id
}: FindOwnerHelpTopicArgs<T>): T | undefined {
    return topics.find((topic) => topic.id === id);
}
