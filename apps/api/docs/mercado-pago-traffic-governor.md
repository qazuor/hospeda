# Mercado Pago traffic governor (HOS-1999)

`HOSPEDA_MERCADO_PAGO_GOVERNOR_MODE` controls the process-wide traffic governor. `off` disables it, `observe` (the default) measures requests and virtual waits without changing request behavior, and `enforce` currently degrades to `observe` until HOS-1999 PR-3. The governor emits one `mp_traffic_window` structured log per traffic class every 60 seconds when that class had traffic. Interactive 429 responses are logged at warning level with capture enabled; cron traffic is also summarized in each affected cron run's `details.providerTraffic`.
