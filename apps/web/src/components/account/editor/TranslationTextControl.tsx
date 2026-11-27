/** Content-sized kit text controls; no internal scrolling for long translations. */
import { useEffect, useRef } from 'react';
import { Textarea, TextInput } from '@/components/account/ui';

/** A single-line name or an autosizing description/summary. */
export function TranslationTextControl({
    singleLine,
    value,
    placeholder,
    describedBy,
    readOnly,
    onChange
}: {
    readonly singleLine: boolean;
    readonly value: string;
    readonly placeholder: string;
    /** Extra `aria-describedby` ids, merged with the surrounding Field's. */
    readonly describedBy?: string;
    readonly readOnly?: boolean;
    readonly onChange: (value: string) => void;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    // biome-ignore lint/correctness/useExhaustiveDependencies: controlled value changes alter scrollHeight without changing the ref.
    useEffect(() => {
        if (singleLine) return;
        const element = ref.current;
        if (!element) return;
        const resize = () => {
            element.style.height = 'auto';
            element.style.height = `${element.scrollHeight}px`;
        };
        resize();
        let width = element.clientWidth;
        const observer =
            typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(() => {
                      if (element.clientWidth === width) return;
                      width = element.clientWidth;
                      resize();
                  });
        observer?.observe(element);
        return () => observer?.disconnect();
    }, [singleLine, value]);
    return singleLine ? (
        <TextInput
            value={value}
            placeholder={placeholder}
            aria-describedby={describedBy}
            readOnly={readOnly}
            onChange={(event) => onChange(event.target.value)}
        />
    ) : (
        <Textarea
            ref={ref}
            rows={3}
            value={value}
            placeholder={placeholder}
            aria-describedby={describedBy}
            readOnly={readOnly}
            style={{ overflow: 'hidden', resize: 'none' }}
            onChange={(event) => onChange(event.target.value)}
        />
    );
}
