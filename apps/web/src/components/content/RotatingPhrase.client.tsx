import type { JSX } from 'react';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RotatingPhraseProps {
    /** Array of phrases matching carousel slide indices */
    readonly phrases: readonly string[];
    /** Current slide index from the carousel */
    readonly currentIndex: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays a phrase that fades in/out synchronized with the hero carousel.
 * Each phrase corresponds to a slide index (wraps with modulo).
 */
export function RotatingPhrase({ phrases, currentIndex }: RotatingPhraseProps): JSX.Element {
    const [displayIndex, setDisplayIndex] = useState(currentIndex);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        if (currentIndex === displayIndex) return;

        setIsFading(true);
        const timeout = setTimeout(() => {
            setDisplayIndex(currentIndex);
            setIsFading(false);
        }, 300);

        return () => clearTimeout(timeout);
    }, [currentIndex, displayIndex]);

    const phrase = phrases[displayIndex % phrases.length] ?? '';

    return (
        <p
            className={`text-base text-white/80 transition-opacity duration-300 sm:text-lg ${
                isFading ? 'opacity-0' : 'opacity-100'
            }`}
            aria-live="polite"
            aria-atomic="true"
        >
            {phrase}
        </p>
    );
}
