function normalize({ text }: { readonly text: string }): string {
    return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Filters server-rendered FAQ groups without changing their disclosure state. */
export function filterFaqDirectory({
    root,
    query
}: {
    readonly root: HTMLElement;
    readonly query: string;
}) {
    const words = normalize({ text: query }).trim().split(/\s+/).filter(Boolean);
    let matchCount = 0;
    for (const group of root.querySelectorAll<HTMLElement>('[data-faq-group]')) {
        let groupMatches = 0;
        for (const item of group.querySelectorAll<HTMLElement>('[data-faq-item]')) {
            const text = normalize({ text: item.textContent ?? '' });
            const matches = words.every((word) => text.includes(word));
            item.hidden = !matches;
            if (matches) groupMatches++;
        }
        group.hidden = groupMatches === 0;
        matchCount += groupMatches;
    }
    const empty = root.querySelector<HTMLElement>('[data-faq-empty]');
    if (empty) empty.hidden = matchCount > 0;
    return { matchCount };
}
