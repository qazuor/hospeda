/** Action when a dynamic block cannot reach its minimum item count. */
export enum NewsletterIfBelowMinEnum {
    SKIP_RUN = 'skip_run',
    HIDE_BLOCK = 'hide_block',
    SEND_ANYWAY = 'send_anyway'
}
