/**
 * Exchange Rates Feature
 *
 * Admin feature for managing currency exchange rates, including:
 * - Viewing current rates from multiple sources
 * - Creating manual rate overrides
 * - Configuring automatic fetch intervals
 * - Viewing rate history
 */

// Types
export type {
    ExchangeRate,
    ExchangeRateConfig,
    ExchangeRateCreateInput,
    ExchangeRateConfigUpdateInput,
    ExchangeRateFilters,
    ExchangeRateHistoryFilters,
    FetchNowResponse
} from './types';

export {
    ExchangeRateTypeEnum,
    ExchangeRateSourceEnum,
    PriceCurrencyEnum
} from './types';

// Hooks
export {
    exchangeRateQueryKeys,
    useExchangeRatesQuery,
    useExchangeRateHistoryQuery,
    useExchangeRateConfigQuery,
    useCreateManualOverrideMutation,
    useDeleteManualOverrideMutation,
    useUpdateConfigMutation,
    useTriggerFetchNowMutation
} from './hooks';

// Columns
export { getExchangeRateColumns } from './columns';

// Components
export { ManualOverrideDialog } from './components/ManualOverrideDialog';
export { FetchConfigForm } from './components/FetchConfigForm';
export { RateHistoryView } from './components/RateHistoryView';
