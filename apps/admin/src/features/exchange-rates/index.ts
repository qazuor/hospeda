/**
 * Exchange Rates Feature
 *
 * Admin feature for managing currency exchange rates, including:
 * - Viewing current rates from multiple sources
 * - Creating manual rate overrides
 * - Configuring automatic fetch intervals
 * - Viewing rate history
 */

// Columns
export { getExchangeRateColumns } from './columns';
export { FetchConfigForm } from './components/FetchConfigForm';
// Components
export { ManualOverrideDialog } from './components/ManualOverrideDialog';
export { RateHistoryView } from './components/RateHistoryView';
// Hooks
export {
    exchangeRateQueryKeys,
    useCreateManualOverrideMutation,
    useDeleteManualOverrideMutation,
    useExchangeRateConfigQuery,
    useExchangeRateHistoryQuery,
    useExchangeRatesQuery,
    useTriggerFetchNowMutation,
    useUpdateConfigMutation
} from './hooks';
// Types
export type {
    ExchangeRate,
    ExchangeRateConfig,
    ExchangeRateConfigUpdateInput,
    ExchangeRateCreateInput,
    ExchangeRateFilters,
    ExchangeRateHistoryFilters,
    FetchNowResponse
} from './types';
export {
    ExchangeRateSourceEnum,
    ExchangeRateTypeEnum,
    PriceCurrencyEnum
} from './types';
