import styles from './UsageCounter.module.css';

/** Show a compact quota beneath its control; the control supplies the full description. */
export function UsageCounter({ value }: { readonly value: string }) {
    return (
        <span
            className={styles.counter}
            aria-hidden="true"
        >
            {value}
        </span>
    );
}
