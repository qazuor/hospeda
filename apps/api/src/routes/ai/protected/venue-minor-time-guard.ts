/** Detects an untimed question about a minor for the venue chat guard. */
export function asksAboutMinorWithoutTime(question: string): boolean {
    const minor =
        /\b(?:hij[oa]s?|menor(?:es)?|nen[ea]s?|chic[oa]s?|niñ[oa]s?|adolescentes?|child(?:ren)?|sons?|daughters?|kids?|minors?|teens?|filh[oa]s?|crianças?)\b|\bde\s+\d{1,2}\s+años?\b/i;
    const time =
        /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(?:h|hs|hrs|am|pm)\b|\ba\s+la(?:s)?\s+\d{1,2}\b|\bde\s+\d{1,2}\s+a\s+\d{1,2}\b|\blas\s+\d{1,2}\b|\b(?:mediodía|medianoche|almorz\w*|almuerz\w*|cena|noche|tarde|mañana|lunch|dinner|night|almoç\w*|jantar|noite)\b/i;
    const area = /\b(?:en|al|a\s+la)\s+(?:el\s+|la\s+)?(?:pista|sal[oó]n|sector|terraza|patio)\b/i;
    const underage = [...question.matchAll(/\b(?:de\s+)?(\d{1,2})\s+años?\b/gi)].some(
        ([, age]) => Number(age) < 18
    );
    const ageWithoutYears = [...question.matchAll(/\bde\s+(\d{1,2})\b/gi)].some(
        ([, age]) => Number(age) < 18
    );
    const withoutAge = question
        .replace(/\b(?:de\s+)?\d{1,2}\s+años?\b/gi, '')
        .replace(ageWithoutYears ? /\bde\s+\d{1,2}\b/gi : /$^/, '');
    return (minor.test(question) || underage) && !time.test(withoutAge) && !area.test(question);
}

/** Returns true for an affirmative opening, excluding conditional Spanish "Si es". */
export function startsWithAffirmation(answer: string): boolean {
    return (
        /^\s*(?:sí(?=$|[\s,.:;!?])|si\s*[, :]|yes\b|sim\b)/i.test(answer) &&
        !/^\s*si\s+es\b/i.test(answer)
    );
}

/** Streams venue chat while replacing an unsafe affirmative opening. */
export async function* guardVenueMinorAnswer(input: {
    readonly chunks: AsyncIterable<string>;
    readonly guarded: boolean;
    readonly locale: string;
    readonly onTrip: () => void;
}): AsyncGenerator<string> {
    const leads: Record<string, string> = {
        es: 'Depende del horario:',
        en: 'It depends on the time:',
        pt: 'Depende do horário:'
    };
    let prefix = '';
    let decided = !input.guarded;
    for await (const chunk of input.chunks) {
        if (decided) {
            yield chunk;
            continue;
        }
        prefix += chunk;
        const end = prefix.search(/[.!?\n]/);
        if (end < 0 && prefix.length < 40) continue;
        decided = true;
        if (startsWithAffirmation(prefix)) {
            input.onTrip();
            const rest = prefix.replace(
                /^\s*(?:sí(?=$|[\s,.:;!?])|si\s*[, :]|yes\b|sim\b)\s*[,!:.-]?\s*/i,
                ''
            );
            yield `${leads[input.locale] ?? leads.es}${rest ? ` ${rest}` : ''}`;
        } else {
            yield prefix;
        }
    }
    if (!decided && prefix && startsWithAffirmation(prefix)) {
        input.onTrip();
        const rest = prefix.replace(
            /^\s*(?:sí(?=$|[\s,.:!?])|si\s*[, :]|yes\b|sim\b)\s*[,!:.-]?\s*/i,
            ''
        );
        yield `${leads[input.locale] ?? leads.es}${rest ? ` ${rest}` : ''}`;
    } else if (!decided && prefix) yield prefix;
}
