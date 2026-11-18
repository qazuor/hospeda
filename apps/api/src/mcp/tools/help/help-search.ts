/**
 * @file help-search.ts
 * @description Finds the owner help topics a free-text question is about
 * (HOS-2333, spec HOS-2335 §5.4): a normalized keyword match, no embeddings.
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
 * keep the catalog order. Pure: the catalog is an argument.
 */

import type {
    OwnerHelpAudience,
    OwnerHelpCallerAudience,
    OwnerHelpTopic
} from '../../../data/owner-help/owner-help.types';

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
    readonly topic: OwnerHelpTopic;
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

/** Whether a topic answers a caller of the given audience. No audience means every topic. */
export function topicServesAudience({
    topic,
    audience
}: {
    readonly topic: OwnerHelpTopic;
    readonly audience?: OwnerHelpCallerAudience;
}): boolean {
    const topicAudience: OwnerHelpAudience = topic.audience;
    return audience === undefined || topicAudience === 'any' || topicAudience === audience;
}

/** Arguments for {@link searchOwnerHelp}. RO-RO. */
export interface SearchOwnerHelpArgs {
    /** The catalog. */
    readonly topics: readonly OwnerHelpTopic[];
    /** The free-text question. Untrusted: only compared, never returned. */
    readonly question: string;
    /** The kind of owner asking; omit for every topic. */
    readonly audience?: OwnerHelpCallerAudience;
}

/**
 * The topics a question is about, best first.
 *
 * @param args - The catalog, the question and the optional audience
 * @returns At most {@link HELP_MAX_TOPICS} topics, empty when nothing matches
 *
 * @example
 * ```typescript
 * searchOwnerHelp({ topics: OWNER_HELP_TOPICS, question: 'cómo subo fotos' });
 * // [photos]
 * ```
 */
export function searchOwnerHelp({
    topics,
    question,
    audience
}: SearchOwnerHelpArgs): readonly OwnerHelpTopic[] {
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
        .slice(0, HELP_MAX_TOPICS)
        .map((entry) => entry.topic);
}

/** Arguments for {@link findOwnerHelpTopic}. RO-RO. */
export interface FindOwnerHelpTopicArgs {
    /** The catalog. */
    readonly topics: readonly OwnerHelpTopic[];
    /** The topic id. */
    readonly id: string;
}

/**
 * One topic by its id.
 *
 * @param args - The catalog and the id
 * @returns The topic, or `undefined` when there is none
 */
export function findOwnerHelpTopic({
    topics,
    id
}: FindOwnerHelpTopicArgs): OwnerHelpTopic | undefined {
    return topics.find((topic) => topic.id === id);
}
