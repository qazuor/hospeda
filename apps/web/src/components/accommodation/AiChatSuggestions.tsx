import styles from './AiChatChrome.module.css';

/** The same listing-specific questions lead to sign-up for guests and the composer for users. */
export function AiChatSuggestions({
    copy,
    action
}: {
    readonly copy: (suffix: string) => string;
    readonly action: { readonly href: string } | { readonly select: (question: string) => void };
}) {
    return (
        <ul className={styles.suggestions}>
            {['guestExample1', 'guestExample2', 'guestExample3'].map((key) => {
                const question = copy(key);
                return (
                    <li key={key}>
                        {'href' in action ? (
                            <a
                                className={styles.chip}
                                href={action.href}
                            >
                                {question}
                            </a>
                        ) : (
                            <button
                                type="button"
                                className={styles.chip}
                                onClick={() => action.select(question)}
                            >
                                {question}
                            </button>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
