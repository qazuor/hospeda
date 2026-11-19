#!/usr/bin/env bash
#
# espera-prod-sync.sh — wakes up Linear issues that were waiting for code to
# reach `main`.
#
# Some work can only happen once a given commit is in production: flipping a
# setting that depends on a fix, running a backfill, a prod-only smoke. Such an
# issue carries the workspace label `espera-prod` and declares, in its
# description, the commit(s) it waits for:
#
#     Espera en prod: f86c23272e
#
# Any number of such lines and of SHAs per line (7-40 hex chars; backticks and
# Markdown bold are fine). Every SHA on every line must be in `main` for the
# issue to fire. A token with both digits and letters is always a SHA; a token
# that is only digits or only letters (a date such as 20261117, a word such as
# defaced, or a SHA that happens to be all digits) counts only if it resolves
# to a commit in this repository.
#
# On each push to `main` (.github/workflows/espera-prod-sync.yml) this script
# lists the open issues carrying the label and, for every issue whose SHAs are
# all ancestors of TARGET_REF:
#   1. comments on the issue saying the code reached `main`;
#   2. removes the `espera-prod` label (so it fires exactly once);
#   3. moves it to `Todo` when it is still in a backlog state.
#
# A merge to `main` is not a deploy: production deploys are a manual Coolify
# click. The comment says so. This is a reminder, not a gate.
#
# Fails loudly (exit 1) and names the issue when: an issue has the label but no
# `Espera en prod:` line, a declared SHA does not exist in the repository, or a
# Linear call fails. A labelled issue that can never fire must not pass quietly.
#
# Environment:
#   LINEAR_API_KEY   required
#   TARGET_REF       ref the SHAs must be ancestors of (default: HEAD)
#   LINEAR_API_URL   default https://api.linear.app/graphql (overridable for tests)
#   ESPERA_LABEL     default espera-prod
#   DRY_RUN          "1" reports what would fire and writes nothing

set -euo pipefail

: "${LINEAR_API_KEY:?LINEAR_API_KEY is required}"
TARGET_REF="${TARGET_REF:-HEAD}"
LINEAR_API_URL="${LINEAR_API_URL:-https://api.linear.app/graphql}"
ESPERA_LABEL="${ESPERA_LABEL:-espera-prod}"
DRY_RUN="${DRY_RUN:-0}"

TARGET_SHA="$(git rev-parse --verify "${TARGET_REF}^{commit}")"
TARGET_SHORT="$(git rev-parse --short "$TARGET_SHA")"

FAILED=""

gql() {
    # No --retry: the same helper sends mutations, and a retried mutation is
    # not idempotent (a second comment).
    curl -sS --max-time 30 "$LINEAR_API_URL" \
        -H "Authorization: $LINEAR_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$1"
}

# A degraded Linear API answers 5xx with an HTML body and curl -sS reports
# success; validate before jq so the error branches stay reachable.
is_ok_json() {
    printf '%s' "$1" | jq -e '(.errors // []) | length == 0' >/dev/null 2>&1
}

fail() {
    echo "::error::$1"
    FAILED="$FAILED $2"
}

# Every nested connection carries an explicit `first`: Linear prices a
# connection at its `first` (50 when omitted) and rejects queries above 10,000
# complexity points regardless of how many nodes actually come back.
LIST_QUERY="$(jq -n --arg label "$ESPERA_LABEL" '{
  query: "query($label: String!) { issues(first: 50, filter: { labels: { some: { name: { eqIgnoreCase: $label } } }, state: { type: { nin: [\"completed\", \"canceled\"] } } }) { pageInfo { hasNextPage } nodes { id identifier description state { type } team { id } labels(first: 25) { nodes { id name } } } } }",
  variables: { label: $label }
}')"
LIST_RESPONSE="$(gql "$LIST_QUERY" || true)"

# A JSON body without the expected shape ({} or a proxy's rate-limit message)
# must not read as "zero issues": that is the silent failure this job exists
# to prevent.
if ! is_ok_json "$LIST_RESPONSE" ||
    ! printf '%s' "$LIST_RESPONSE" | jq -e '(.data.issues.nodes | type) == "array"' >/dev/null 2>&1; then
    echo "::error::Could not list '$ESPERA_LABEL' issues from Linear. Response: $LIST_RESPONSE"
    exit 1
fi

if [ "$(printf '%s' "$LIST_RESPONSE" | jq -r '.data.issues.pageInfo.hasNextPage // false')" = "true" ]; then
    fail "More than 50 open issues carry '$ESPERA_LABEL'; only the first page was checked. Add pagination to scripts/espera-prod-sync.sh." "(pagination)"
fi

COUNT="$(printf '%s' "$LIST_RESPONSE" | jq '.data.issues.nodes | length')"
echo "Open issues labelled '$ESPERA_LABEL': $COUNT (target $TARGET_SHORT)"

# Prints a team's "Todo" state id; empty when the team has none or Linear errs.
todo_state_for() {
    local query response
    query="$(jq -n --arg teamId "$1" '{
      query: "query($teamId: String!) { team(id: $teamId) { states(first: 1, filter: { name: { eq: \"Todo\" } }) { nodes { id } } } }",
      variables: { teamId: $teamId }
    }')"
    response="$(gql "$query" || true)"
    printf '%s' "$response" | jq -r '.data.team.states.nodes[0].id // empty' 2>/dev/null || true
}

while IFS= read -r NODE; do
    [ -n "$NODE" ] || continue
    ID="$(printf '%s' "$NODE" | jq -r '.identifier')"
    UUID="$(printf '%s' "$NODE" | jq -r '.id')"
    echo "::group::$ID"

    # Every declaration line counts (an issue may wait for several PRs). The
    # colon may sit inside or outside Markdown bold: `**Espera en prod:**` and
    # `**Espera en prod**:` are both accepted.
    DECLARED="$(printf '%s' "$NODE" | jq -r '.description // ""' |
        sed -nE 's/.*[Ee][Ss][Pp][Ee][Rr][Aa] [Ee][Nn] [Pp][Rr][Oo][Dd][*_ ]*:(.*)/\1/p')"
    # A SHA token is 7-40 hex chars. One with both a digit and a letter is
    # always taken, so a typo still fails loudly as an unknown SHA below. One
    # that is only digits or only letters is ambiguous: a date (20261117) or a
    # hex-looking word (defaced) must not be read as a commit, but a real short
    # SHA can be all digits (HOS-2363). Those are taken only when they resolve
    # to a commit; the workflow checks out with fetch-depth 0, so every pushed
    # commit resolves.
    SHAS=""
    for TOKEN in $(printf '%s\n' "$DECLARED" | grep -oiE '\b[0-9a-f]{7,40}\b' | tr '[:upper:]' '[:lower:]' | sort -u || true); do
        if printf '%s' "$TOKEN" | grep -qE '[0-9]' && printf '%s' "$TOKEN" | grep -qE '[a-f]'; then
            SHAS="$SHAS$TOKEN"$'\n'
        elif git rev-parse --verify -q "${TOKEN}^{commit}" >/dev/null; then
            SHAS="$SHAS$TOKEN"$'\n'
        fi
    done
    SHAS="$(printf '%s' "$SHAS" | sed '/^$/d')"

    if [ -z "$SHAS" ]; then
        fail "$ID has the '$ESPERA_LABEL' label but no 'Espera en prod: <sha>' line in its description, so it can never fire. Add the line or remove the label." "$ID"
        echo "::endgroup::"
        continue
    fi

    PENDING=""
    UNKNOWN=""
    for SHA in $SHAS; do
        if ! git rev-parse --verify -q "${SHA}^{commit}" >/dev/null; then
            UNKNOWN="$UNKNOWN $SHA"
        elif ! git merge-base --is-ancestor "$SHA" "$TARGET_SHA"; then
            PENDING="$PENDING $SHA"
        fi
    done

    if [ -n "$UNKNOWN" ]; then
        fail "$ID declares SHA(s) that do not exist in this repository:$UNKNOWN. Fix the 'Espera en prod:' line." "$ID"
        echo "::endgroup::"
        continue
    fi

    if [ -n "$PENDING" ]; then
        echo "$ID: still waiting for$PENDING."
        echo "::endgroup::"
        continue
    fi

    # Literal backticks for Markdown code spans; paste takes one delimiter only.
    # shellcheck disable=SC2016
    SHA_LIST="$(printf '%s\n' "$SHAS" | sed 's/.*/`&`/' | paste -sd ',' | sed 's/,/, /g')"
    if [ "$DRY_RUN" = "1" ]; then
        echo "$ID: would fire ($SHA_LIST in main at $TARGET_SHORT)."
        echo "::endgroup::"
        continue
    fi

    BODY="El código que esperaba este issue (${SHA_LIST}) ya está en \`main\` (\`${TARGET_SHORT}\`). Ojo: el merge a \`main\` no es el deploy. Confirmá que prod corre ese commit antes de actuar. Saqué la etiqueta \`${ESPERA_LABEL}\`."
    COMMENT_MUTATION="$(jq -n --arg issueId "$UUID" --arg body "$BODY" '{
      query: "mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success } }",
      variables: { issueId: $issueId, body: $body }
    }')"
    COMMENT_RESPONSE="$(gql "$COMMENT_MUTATION" || true)"
    if ! is_ok_json "$COMMENT_RESPONSE" || [ "$(printf '%s' "$COMMENT_RESPONSE" | jq -r '.data.commentCreate.success // false')" != "true" ]; then
        fail "$ID: could not comment, left untouched. Response: $COMMENT_RESPONSE" "$ID"
        echo "::endgroup::"
        continue
    fi

    LABEL_IDS="$(printf '%s' "$NODE" | jq -c --arg label "$ESPERA_LABEL" '[.labels.nodes[] | select((.name | ascii_downcase) == ($label | ascii_downcase)) | .id]')"
    STATE_TYPE="$(printf '%s' "$NODE" | jq -r '.state.type')"
    TODO_ID=""
    if [ "$STATE_TYPE" = "backlog" ]; then
        TODO_ID="$(todo_state_for "$(printf '%s' "$NODE" | jq -r '.team.id')")"
        [ -n "$TODO_ID" ] || echo "::warning::$ID: its team has no 'Todo' state; removing the label only."
    fi
    if [ -n "$TODO_ID" ]; then
        INPUT="$(jq -n --argjson labels "$LABEL_IDS" --arg state "$TODO_ID" '{ removedLabelIds: $labels, stateId: $state }')"
    else
        INPUT="$(jq -n --argjson labels "$LABEL_IDS" '{ removedLabelIds: $labels }')"
    fi
    UPDATE_MUTATION="$(jq -n --arg id "$UUID" --argjson input "$INPUT" '{
      query: "mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }",
      variables: { id: $id, input: $input }
    }')"
    UPDATE_RESPONSE="$(gql "$UPDATE_MUTATION" || true)"
    if ! is_ok_json "$UPDATE_RESPONSE" || [ "$(printf '%s' "$UPDATE_RESPONSE" | jq -r '.data.issueUpdate.success // false')" != "true" ]; then
        fail "$ID: commented but could not remove the label; the next push to main will comment again. Remove '$ESPERA_LABEL' by hand. Response: $UPDATE_RESPONSE" "$ID"
        echo "::endgroup::"
        continue
    fi

    echo "$ID: fired ($SHA_LIST in main at $TARGET_SHORT)."
    echo "::endgroup::"
done < <(printf '%s' "$LIST_RESPONSE" | jq -c '.data.issues.nodes[]')

if [ -n "$FAILED" ]; then
    echo "::error::espera-prod sync failed for:$FAILED"
    exit 1
fi
