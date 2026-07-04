# Anexo — Análisis detallado de consolidación de memoria (HOS-81)

Mapeo nota-por-nota de las **77 notas de origen** (`hospeda2` 68 + `hospeda3` 7 +
`hospeda-apps-web` 1 + `hospeda-spec-143` 1) hacia el destino **`hospeda`** (58 notas).

Leyenda de acciones:

- **MOVER**: portar el archivo tal cual a `hospeda/memory/`.
- **FUSIONAR→x**: doblar contenido dentro de la nota `x` existente; no crea archivo.
- **BORRAR-DUP→x**: ya cubierta 1:1 por la nota `x` de hospeda.
- **BORRAR-OBS**: efímera / de sistema retirado; sin contenido reutilizable.

---

## MOVER — 57 notas (conocimiento único reutilizable)

### Feedback / convenciones / gotchas de tooling (9 — de hospeda2)

- `feedback_commitlint_rules.md` — subject en minúscula + header ≤100 chars, con ejemplos.
- `feedback_concise_summaries.md` — preferencia de verbosidad (distinta de `feedback-user-prefers-robust`).
- `feedback_git_stash_u_untracked_unreliable.md` — gotcha de `git stash -u`.
- `feedback_linear_state_not_auto_updated.md` — Backlog→In Progress no auto-transiciona.
- `feedback_no_chained_git_commits.md` — rtk enmascara fallos de commit/push encadenados con `&&`.
- `feedback_process_env_undefined_vs_delete.md` — Node coacciona `=undefined` a string truthy; fuga de keys locales a tests.
- `feedback_report_dont_act_on_cleanup.md` — "reportar, no actuar" en barridos destructivos.
- `feedback_task_state_json_surgical_edits.md` — edición quirúrgica de `tasks/state.json` (task-master NO está retirado, sólo `.qtm`).
- `feedback_user_prefers_robust.md` — liderar con la opción robusta.

### Conocimiento durable de hospeda3 + suelta spec-143 (4)

- `hospeda3/hospeda-git-push-verify.md` — rtk trunca el output de push a "ok" aun en no-op; receta de verificación.
- `hospeda3/hospeda-rtk-vitest-gotcha.md` — workaround concreto de vitest bajo rtk.
- `hospeda3/i18n-vite-cache-gotcha.md` — staleness de cache ESM de Vite para keys i18n nuevas.
- `hospeda-spec-143/spec_143_webhook_qzpay_refactor.md` — bug de doble validación de firma en webhook qzpay + formato dual de webhook MP (WebHook v1.0 vs Feed v2.0 IPN). **Al portar: recortar el andamiaje de handoff viejo (branches, creds temporales); conservar el patrón del bug + los hechos de formato de webhook.**

### Project-notes con root-causes reutilizables (44 — de hospeda2)

`project_admin_process_undefined_fix` · `project_api_log_billing_hardening` (⚠ ver contradicción MP `TEST-`) · `project_db_fresh_dev_worktree_incident` (crítico: `db:fresh-dev` en worktree destruye el postgres compartido) · `project_env_audit_for_deploy` · `project_hos3_a11y_baseline_shrink_shipped` · `project_hos50_session2_progress` · `project_hos76_astro7_migration_pr_open` · `project_linear_github_autoclose_risk` · `project_linear_migration_plugin_cache_gotcha` · `project_matview_blocks_migrate_on_staging` (WILL REPEAT ON PROD) · `project_precommit_hook_hijacks_spec_branch` (⚠ verificar que el hook ya mire `.specs/HOS-N` y no `.qtm`) · `project_seed_not_incremental_billing` · `project_spec129_shipped` · `project_spec156_shipped` (sobreviviente consolidado del cluster SPEC-156) · `project_spec162_shipped` · `project_spec165_in_progress` · `project_spec183_inprogress` · `project_spec203_started` · `project_spec204_p1_shipped` · `project_spec214_shipped` (⚠ contradicción AccommodationTypeEnum) · `project_spec216_shipped` · `project_spec218_shipped` · `project_spec223_inprogress` · `project_spec229_shipped` · `project_spec230_shipped` · `project_spec251_inprogress` · `project_spec252_inprogress` · `project_spec253_shipped` · `project_spec269_bundle_icons` · `project_spec284_signal_and_tasks` · `project_spec285_worktree` · `project_spec287_shipped` (BETA-106) · `project_spec289_inprogress` · `project_spec291_worktree` · `project_spec294_worktree` · `project_spec295_created` · `project_spec299_implemented` · `project_spec310_c1` · `project_spec321_pr_open` (Accept-header rompía SSE) · `project_specs296_303_created` · `project_staging_bugfix_campaign` (**la de mayor valor del lote**; `<ClientRouter/>` no re-ejecuta scripts tras nav SPA — pegó 3×) · `project_worktree_dup_dev_server_stale` · `project_worktree_one_command` (hospeda NO tiene notas de worktree-lifecycle — hueco real) · `project_wt_cli_tilde_bug`.

---

## FUSIONAR — 6 notas (se doblan en una nota existente de hospeda)

| Origen | Se funde en | Qué aporta |
|--------|-------------|------------|
| `hospeda2/feedback_resource_heavy_commands.md` | `feedback-no-concurrent-heavy-tasks.md` | frase de scoping `--filter <pkg>` + "pasar la regla a subagentes verbatim". |
| `hospeda3/no-heavy-parallel-runs.md` | `feedback-no-concurrent-heavy-tasks.md` | 3ª copia; citas verbatim del owner + incidente 451-files/3632-tests + `--maxWorkers=2` + ref SPEC-188. |
| `hospeda2/project_pr2019_oom_stale_tanstack.md` | `dependabot-prod-group-shard4-mine.md` | **sobrescribe** el "still investigating" con la causa raíz resuelta (ceiling de memoria nativa del bump agregado `@radix-ui/*`). |
| `hospeda2/project_spec156_pr1_decisions_locked.md` | `project_spec156_shipped.md` | lista única de 8 permission-enums + tabla de asignación de roles. |
| `hospeda2/project_spec265_review_fixes.md` | `spec-265-ai-search-ux.md` | fase de implementación/review-fix (PR #1862, 9 fixes). Combinar, no reemplazar. |
| `hospeda2/project_staging_to_main_promotion_gotchas.md` | `dependabot-security-routing.md` | caso de promoción staging→main; descartar su parte de A11y-Sweep (ya cubierta por `project_spec294_worktree`). |

---

## BORRAR-DUP — 2 notas (cubiertas 1:1 por una nota de hospeda)

- `hospeda2/feedback_admin_urls_english_no_redirects.md` → **byte-idéntica** a `hospeda/feedback-admin-urls-english-no-redirects.md` (mismo `originSessionId`).
- `hospeda2/project_spec172_impl_complete.md` → su único gotcha durable (rtk finge éxito de push) ya está en `local-dev-setup.md`; el resto es bookkeeping de spec cerrada.

---

## BORRAR-OBS — 12 notas (efímeras / de sistema retirado)

Sistema `.qtm` / CSV / numbering local SPEC-NNN retirado:

- `hospeda2/feedback_spec_allocation_use_skill.md` — allocation local retirada; Linear es la fuente de IDs.
- `hospeda2/feedback_specs_prioritization_tracker.md` — el `specs-prioritization.csv` fue eliminado.
- `hospeda2/project_prod_readiness_sprint.md` — snapshot sobre `.qtm/tasks/index.json` retirado.
- `hospeda2/project_spec156_follow_ups.md` — todo operativo atado al índice local retirado.
- `hospeda2/project_spec156_pr_strategy.md` — tabla de split de PRs, superada por `spec156_shipped`.

Estado efímero de spec cerrada / punto-en-el-tiempo:

- `hospeda2/project_security_scanning_2026_06.md` — snapshot de triage de junio.
- `hospeda2/project_spec191_shipped.md` — lista fina de open-items obsoleta.
- `hospeda2/project_two_full_clones_hospeda.md` — describe el estado transitorio de esta misma migración; se auto-obsoleta al terminar.
- `hospeda3/spec-170-active.md` — snapshot de progreso, sin gotcha durable.
- `hospeda3/spec-208-prod-readiness.md` — log de status de PRs de remediación.
- `hospeda3/spec-228-active.md` — shipped; su gotcha de commitlint ya lo cubre `feedback_commitlint_rules` (movida).
- `hospeda-apps-web/session-permissions.md` — log efímero de 2 líneas de un cleanup de 2026-02-27.

---

## PURGAR en hospeda — 3 notas del propio destino ya obsoletas

- `project_spec_index_drift.md` — enteramente sobre el tracker local `.qtm`/`index.json` retirado.
- `spec-279-cross-user-renumber.md` — colisión de numbering local SPEC-NNN; superada por IDs atómicos de Linear.
- `spec-allocation-atomic-lock.md` — reserva por git-tag para la allocation local retirada.

> `dependabot-prod-group-shard4-mine.md` NO se purga: se **actualiza** con el merge del OOM resuelto.

---

## Clusters semánticos detectados

1. **"Nunca correr tareas pesadas en paralelo"** (3 dirs, 3 nombres): `hospeda/feedback-no-concurrent-heavy-tasks` + `hospeda2/feedback_resource_heavy_commands` + `hospeda3/no-heavy-parallel-runs`. **Sobrevive** la de hospeda, enriquecida.
2. **SPEC-156** (4 archivos en hospeda2): `pr_strategy` → `pr1_decisions_locked` → `follow_ups` + `shipped`. **Sobrevive** `project_spec156_shipped` (absorbe la tabla de permisos/roles); los otros 3 se descartan/funden.
3. **Admin-URLs-English** (2 dirs): byte-idénticas. **Sobrevive** la de hospeda.
4. **rtk enmascara fallos de git-push** (3 notas, no idénticas): cubren modos de fallo distintos → las 2 de origen MOVEN; candidatas a futura nota única "rtk enmascara fallos de git".
5. **OOM de admin en bump de Dependabot** (2 notas, mismo incidente): abierta (hospeda) vs resuelta (hospeda2). **Sobrevive** la de hospeda, fusionada con la resolución.
6. **Semántica de tokens MP `TEST-`/`APP_USR-`** (3 notas, relacionadas pero distintas): facetas no solapadas → las 3 sobreviven, pero con la tensión factual señalada.

---

## Contradicciones factuales a resolver (NO reconciliar en silencio)

1. **`AccommodationTypeEnum`**: `project_spec214_shipped` dice que `apart_hotel/estancia/bed_and_breakfast` NO están en el enum; el `MEMORY.md` (misma fecha) dice que **SÍ** vía SPEC-213. → Verificar contra código actual; la memoria indica que **son reales** — corregir la línea al portar.
2. **Token MP `TEST-`**: `project_api_log_billing_hardening` implica que los tokens `TEST-` son válidos/aceptados; `gotcha_mercadopago_credentials` dice que **no hay** prefijo `TEST-`. → Plausiblemente scopes distintos (app-level vs test-user vinculado); verificar y anotar al portar.

---

## Recuento final

| Acción | Cant. |
|--------|-------|
| MOVER (archivos nuevos) | 57 |
| FUSIONAR (dentro de existentes) | 6 |
| BORRAR-DUP | 2 |
| BORRAR-OBS | 12 |
| **Total origen clasificado** | **77** |
| PURGAR en hospeda | 3 |

**Conteo final de notas en `hospeda`**: 58 − 3 (purga) + 57 (mover) = **112 notas**.
