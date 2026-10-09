/** Test-only entry point for the in-memory payment provider and its controls. */
export {
    FAKE_LIES,
    FAKE_LISTS,
    FAKE_LISTS_PATH,
    FAKE_RULES,
    FAKE_SIMULATIONS,
    type FakeLie,
    type FakeLieId,
    type FakeLists,
    FakeListsSchema,
    type FakeMeasurement,
    type FakeRule,
    type FakeSimulation,
    type FakeSimulationId,
    MEASUREMENT_ACCOUNTS,
    parseFakeLists
} from './fake-lists';
export {
    decodeFakeNotice,
    decodeFakeNoticeBody,
    encodeFakeNotice,
    encodeFakeNoticeBody,
    FAKE_NOTICE_CONTENT_TYPES,
    FakeNoticeBodySchema,
    type FakeNoticeFormat
} from './fake-notice';
export {
    type FakePaymentProviderOptions,
    FakePaymentProviderOptionsSchema,
    type HonestAbout,
    type Simulate
} from './fake-options';
export {
    FAKE_NOTICE_CHANNEL_HEADER,
    FAKE_NOTICE_DELAY_MS,
    type FakeNoticeChannel
} from './fake-outbox';
export {
    FAKE_CAPABILITY_SUPPORT,
    FAKE_HONEST_LINK_LIFETIME_MS,
    FakePaymentProvider,
    NOT_REFUNDABLE_MESSAGE
} from './fake-payment-provider';
export {
    AMOUNT_ABOVE_CEILING_MESSAGE,
    AMOUNT_BELOW_FLOOR_MESSAGE,
    FAKE_AMOUNT_CEILING_MINOR,
    FAKE_AMOUNT_FLOOR_MINOR,
    FAKE_CURRENCY,
    nextChargeBatch
} from './fake-rules';
