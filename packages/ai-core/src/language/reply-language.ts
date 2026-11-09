/**
 * Deterministic reply language for the listing chat (HOS-2095, round 2).
 *
 * A blind-graded sweep of 560 answers showed that half of the cheapest model's
 * answers to English or Portuguese questions came back in Spanish, even with a
 * rule telling it to answer in the language of the latest message. Asking the
 * model to DETECT the language is the part it gets wrong; following an explicit
 * "Reply in English." is not. So the language is decided here, server-side,
 * and stated as the last line of the system message — the position round 1
 * measured as the one the model weighs most.
 *
 * The detector is a small, dependency-free stopword/diacritic scorer for the
 * three supported locales. It is deliberately conservative: when the message is
 * too short ("ok", "wifi?", a lone greeting) or too mixed ("tienen parking for
 * two cars?") it returns `null`, and the caller keeps the generic language rule
 * in charge. A wrong explicit instruction is worse than none.
 *
 * Lives in `@repo/ai-core` (not `apps/api`) so the chat route and the sweep
 * script share ONE implementation — the sweep measures what production sends.
 *
 * @module ai-core/language/reply-language
 */

/** A language the listing chat can be told to reply in. */
export type ReplyLanguage = 'es' | 'en' | 'pt';

/** Ordered list of {@link ReplyLanguage} values. */
const LANGUAGES: readonly ReplyLanguage[] = ['es', 'en', 'pt'] as const;

/**
 * Marker words per language, written in their ACCENT-STRIPPED lowercase form and
 * split by weight: `STRONG` words (2 points) point at one language on their own;
 * `WEAK` words (1 point) are function words and greetings.
 *
 * A word common to two of the languages (`para`, `que`, `piscina`, `familia`,
 * `cachorro`, `comida`, `adultos`…) is deliberately absent from every list: it
 * carries no signal and would only blur the margin.
 */
const WEAK_WORDS: Readonly<Record<ReplyLanguage, string>> = {
    es: 'el la los las del al lo le les un una y en con es mi su sus sale hola buenas si no hora horario entrada somos dias',
    en: "the an is are do does you your we i my our it of to for with and or in on at from there any can how much many what what's where when which us two hi hello hey it's there's i'm don't can't restaurant cars car by they be will",
    pt: 'da das na nas em oi ola sim levar saida'
};

const STRONG_WORDS: Readonly<Record<ReplyLanguage, string>> = {
    es: 'hay tienen tiene tenes tengo puedo puede pueden podes quiero queres aceptan acepta pileta mascota mascotas perro perros gato gatos ninos nino nenes nene chicos hijo hijos desayuno cochera habitacion habitaciones noche noches cuanto cuanta cuesta precio lejos cerca playa gracias muy mucho tambien ustedes vos che llevar almorzar cenar queda donde cual cuales menores estamos salida aire acondicionado tarjeta hacen ofrecen sirven incluye parrilla dormitorios',
    en: 'breakfast included include includes allow allowed pets pet dog dogs cat cats bring pool room rooms night nights price prices people far near beach time leave leaves open lunch dinner kids children family fit thanks thank please have has sundays cost costs pay card serve food located suitable friendly adults air conditioning bed beds bathroom need grill smoking',
    pt: 'voce voces um uma com nao tem aceita aceitam posso meu minha quanto custa diaria duas dois pessoas criancas estacionamento quarto quartos qual quais passeio fica perto longe praia manha obrigado obrigada tambem muito onde animais estimacao ar servem cabemos cartao gostaria quero pode churrasqueira'
};

/**
 * English loanwords that rioplatense Spanish and Portuguese use as-is ("tienen
 * parking?", "hay wifi?"). They score for nobody, or `-ing` would turn a Spanish
 * question English.
 */
const LOANWORDS: ReadonlySet<string> = new Set(
    'parking camping living wifi spa delivery brunch happy check ok okay tour pub show'.split(' ')
);

/** Builds the `word → weight` lookup of one language. */
function buildMarkers(language: ReplyLanguage): ReadonlyMap<string, 1 | 2> {
    const map = new Map<string, 1 | 2>();
    for (const word of WEAK_WORDS[language].split(' ')) map.set(word, 1);
    for (const word of STRONG_WORDS[language].split(' ')) map.set(word, 2);
    return map;
}

/** Lookup per language, built once at module load. */
const MARKERS: Readonly<Record<ReplyLanguage, ReadonlyMap<string, 1 | 2>>> = {
    es: buildMarkers('es'),
    en: buildMarkers('en'),
    pt: buildMarkers('pt')
};

/**
 * Spelling patterns of an UNLISTED token that only one language produces: the
 * English `-ing` ending and `th`, the Portuguese `nh`/`lh` digraphs. Worth one
 * point each; they let a message full of words outside the lists still count.
 */
const TOKEN_SHAPES: ReadonlyArray<readonly [RegExp, ReplyLanguage]> = [
    [/^\p{L}{3,}ing$/u, 'en'],
    [/th/u, 'en'],
    [/[ln]h/u, 'pt']
];

/**
 * Raw (accented) tokens that mean something only in one language. Checked BEFORE
 * accent stripping, because stripping is what makes them ambiguous: Portuguese
 * `é` would become `e`, Spanish `qué` would become the shared `que`.
 */
const RAW_MARKERS: Readonly<Record<string, readonly [ReplyLanguage, 1 | 2]>> = {
    é: ['pt', 2],
    qué: ['es', 2],
    cuál: ['es', 2],
    dónde: ['es', 2],
    más: ['es', 2]
};

/** Characters that only one of the three languages uses, with the language. */
const CHAR_CUES: ReadonlyArray<readonly [RegExp, ReplyLanguage]> = [
    [/[ñ¿¡]/u, 'es'],
    [/[ãõçâêô]/u, 'pt']
];

/** Weight of one character cue (counted at most once per language). */
const CHAR_CUE_WEIGHT = 2;

/** Minimum winning score to be confident: one strong word, or two weak ones. */
const MIN_SCORE = 2;

/**
 * Minimum number of words in the message. A one-word message ("pileta?",
 * "hola?", "Thanks!") is a keyword or a greeting, not a sentence whose language
 * the visitor chose; it stays undecided even when the word is unambiguous.
 */
const MIN_TOKENS = 2;

/** Minimum absolute lead over the runner-up. */
const MIN_LEAD = 2;

/** Strips combining diacritics after NFD normalization. */
function stripAccents(value: string): string {
    return value.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Result of {@link detectMessageLanguage}. */
export interface DetectMessageLanguageResult {
    /** The detected language, or `null` when the message is too short or too mixed to decide. */
    readonly language: ReplyLanguage | null;
    /** Weighted score per language, exposed for diagnostics and tests. */
    readonly scores: Readonly<Record<ReplyLanguage, number>>;
}

/**
 * Detects the language of one visitor message among `es`, `en` and `pt`.
 *
 * Confidence requires all of: at least {@link MIN_TOKENS} words, a winning
 * score of at least {@link MIN_SCORE}, a lead of at least
 * {@link MIN_LEAD} points, and at least double the runner-up's score.
 *
 * @param input.text - The visitor's message.
 * @returns `{ language, scores }`; `language` is `null` when not confident.
 */
export function detectMessageLanguage({
    text
}: {
    readonly text: string;
}): DetectMessageLanguageResult {
    const scores: Record<ReplyLanguage, number> = { es: 0, en: 0, pt: 0 };
    const lower = text.normalize('NFC').toLowerCase().replace(/[’`´]/g, "'");

    for (const [pattern, language] of CHAR_CUES) {
        if (pattern.test(lower)) {
            scores[language] += CHAR_CUE_WEIGHT;
        }
    }

    const tokens = lower.match(/[\p{L}']+/gu) ?? [];
    for (const rawToken of tokens) {
        const token = rawToken.replace(/^'+|'+$/g, '');
        if (token === '') continue;
        const raw = RAW_MARKERS[token];
        if (raw) {
            scores[raw[0]] += raw[1];
            continue;
        }
        const key = stripAccents(token);
        if (LOANWORDS.has(key)) continue;
        let listed = false;
        for (const language of LANGUAGES) {
            const weight = MARKERS[language].get(key);
            if (weight) {
                scores[language] += weight;
                listed = true;
            }
        }
        if (listed) continue;
        for (const [shape, language] of TOKEN_SHAPES) {
            if (shape.test(key)) {
                scores[language] += 1;
                break;
            }
        }
    }

    const ranked = [...LANGUAGES].sort((a, b) => scores[b] - scores[a]);
    const top = ranked[0] as ReplyLanguage;
    const runnerUp = scores[ranked[1] as ReplyLanguage];
    const best = scores[top];
    const confident =
        best >= MIN_SCORE &&
        tokens.length >= MIN_TOKENS &&
        best - runnerUp >= MIN_LEAD &&
        best >= 2 * runnerUp;

    return { language: confident ? top : null, scores };
}

/**
 * The explicit reply-language line, one per language, written IN that language.
 *
 * The English and Portuguese lines also state that a question in that language
 * about the listing is on-topic: the sweep caught the model opening a legitimate
 * English question with "I can only help with questions about this property".
 */
export const REPLY_LANGUAGE_INSTRUCTIONS: Readonly<Record<ReplyLanguage, string>> = {
    en: "- Reply in English. The visitor's latest message is written in English; a question in English about this listing is on-topic and gets a normal answer.",
    es: '- Respondé en español. El último mensaje del visitante está escrito en español.',
    pt: '- Responda em português. A última mensagem do visitante está escrita em português; uma pergunta em português sobre este anúncio está dentro do tema e recebe uma resposta normal.'
} as const;

/** Result of {@link buildReplyLanguageInstruction}. */
export interface ReplyLanguageInstruction {
    readonly language: ReplyLanguage | null;
    /** The line to append, or `null` when the language could not be decided. */
    readonly instruction: string | null;
}

/**
 * Builds the explicit reply-language line for the visitor's latest message.
 *
 * @param input.latestUserMessage - Content of the visitor's latest message.
 * @returns `{ language, instruction }`, both `null` when not confident.
 */
export function buildReplyLanguageInstruction({
    latestUserMessage
}: {
    readonly latestUserMessage: string;
}): ReplyLanguageInstruction {
    const { language } = detectMessageLanguage({ text: latestUserMessage });
    return language
        ? { language, instruction: REPLY_LANGUAGE_INSTRUCTIONS[language] }
        : { language: null, instruction: null };
}

/**
 * Appends the explicit reply-language line as the LAST line of a listing-chat
 * system message. When the language cannot be decided, the system message is
 * returned byte-identical and the generic language rule stays in charge.
 *
 * This is the one function both the chat route and the sweep call, so the sweep
 * sends the model exactly what production does.
 *
 * @param input.system - The assembled system message (`buildChatSystemMessage`).
 * @param input.latestUserMessage - Content of the visitor's latest message.
 * @returns `{ system, language }`.
 */
export function appendReplyLanguageInstruction({
    system,
    latestUserMessage
}: {
    readonly system: string;
    readonly latestUserMessage: string;
}): { readonly system: string; readonly language: ReplyLanguage | null } {
    const { language, instruction } = buildReplyLanguageInstruction({ latestUserMessage });
    return instruction ? { system: `${system}\n${instruction}`, language } : { system, language };
}
