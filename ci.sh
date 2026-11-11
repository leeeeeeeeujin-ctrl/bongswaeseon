#!/bin/bash
# solver v2 <-> GitHub Actions (branch `solver` of leeeeeeeeujin-ctrl/bongswaeseon; REST only, GraphQL is blocked here).
#   ci.sh init                      clone the game repo into S/solver2/repo and check out (or create, orphan) the branch `solver`
#   ci.sh push [--with-results]     snapshot the game files the sim needs from /home/claude/td (game.js econ.js meta.js test/im_sim.js) into game/,
#                                   copy the solver code, game_v1/, data/ into the clone, commit, push ONLY the branch solver (results/ only with --with-results)
#   ci.sh run mode=search stages=IM-02 decks=starter crit=lost1 [squad=.. name=.. hours=5.4 split=stage extra=..]   start a run; prints the run id
#                                   (REST workflow_dispatch first; if that is refused, a commit of ci/request.json to the branch triggers the same workflow)
#   ci.sh status [RUN]              recent runs, or one run's jobs (with durations)
#   ci.sh wait RUN [SECS]           poll until the run completes (default every 60 s)
#   ci.sh pull                      fetch the branch and copy its results/ into S/solver2/results
#   ci.sh speed RUN                 bench lines and job durations of a run
set -euo pipefail
OWNER=leeeeeeeeujin-ctrl; REPO=bongswaeseon; WF=solver.yml; BR=solver
S2="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; CL="$S2/repo"; TD=/home/claude/td; SRC=/home/claude/bongswaeseon
api() { gh api -H "Accept: application/vnd.github+json" "$@"; }
cmd="${1:-help}"; shift || true
case "$cmd" in
  init)
    if [ ! -d "$CL/.git" ]; then git clone -q --no-checkout "$SRC" "$CL"; git -C "$CL" remote set-url origin "https://github.com/$OWNER/$REPO"; fi
    cd "$CL"
    if git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then git fetch -q origin "$BR"; git checkout -q -B "$BR" "origin/$BR"; echo "checked out existing origin/$BR";
    else git checkout -q --orphan "$BR"; git rm -r -q -f . 2>/dev/null || true; echo "new orphan branch $BR (main's files removed from this clone's index and work tree)"; fi ;;
  push)
    [ -d "$CL/.git" ] || "$0" init
    cd "$CL"; [ "$(git symbolic-ref --short HEAD)" = "$BR" ] || { echo "clone is not on $BR"; exit 1; }
    if git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1 && git rev-parse -q --verify HEAD >/dev/null; then git pull -q --rebase origin "$BR" || true; fi
    # the game snapshot (files the sim needs), into both the local solver2 and the clone
    mkdir -p "$S2/game/test"; for f in game.js econ.js meta.js; do cp "$TD/$f" "$S2/game/$f"; done; cp "$TD/test/im_sim.js" "$S2/game/test/im_sim.js"
    ( cd "$S2/game" && { echo "{"; echo " \"taken\": \"$(date -u +%FT%TZ)\", \"from\": \"$TD\","; echo " \"md5\": {"; md5sum game.js econ.js meta.js test/im_sim.js | awk '{printf "  \"%s\": \"%s\"%s\n", $2, $1, (NR<4?",":"")}'; echo " }"; echo "}"; } > SNAPSHOT.json )
    for d in game game_v1 data; do mkdir -p "$CL/$d"; cp -a "$S2/$d/." "$CL/$d/"; done
    mkdir -p "$CL/.github/workflows"; cp "$S2/.github/workflows/solver.yml" "$CL/.github/workflows/solver.yml"
    cp "$S2"/*.js "$S2/ci.sh" "$S2/USAGE.txt" "$S2/.gitignore" "$CL/"; [ -f "$S2/viewer_sm.patch" ] && cp "$S2/viewer_sm.patch" "$CL/"
    if [ "${1:-}" = "--with-results" ]; then mkdir -p "$CL/results"; tar -C "$S2/results" --exclude=./cache -cf - . | tar -C "$CL/results" -xf -; fi
    git add -A; if git diff --cached --quiet; then echo "nothing new to push"; else git commit -q -m "solver v2: code + game snapshot $(cut -c1-12 <<< "$(md5sum "$S2/game/game.js")")"; fi
    git push origin "HEAD:refs/heads/$BR" 2>&1 | tail -3 ;;
  run)
    declare -A IN=([mode]=search [stages]=IM-02..WL-09 [decks]=starter,T4,T5,T6 [crit]=lost1,full [squad]= [name]= [hours]=5.4 [split]=stage [extra]=)
    for kv in "$@"; do IN[${kv%%=*}]="${kv#*=}"; done
    args=(-f ref="$BR"); for k in "${!IN[@]}"; do args+=(-f "inputs[$k]=${IN[$k]}"); done
    t0=$(date -u +%FT%TZ)
    if api -X POST "repos/$OWNER/$REPO/actions/workflows/$WF/dispatches" "${args[@]}" >/dev/null 2>"$S2/.dispatch_err"; then
      for i in $(seq 1 30); do sleep 4; id=$(api "repos/$OWNER/$REPO/actions/runs?branch=$BR&event=workflow_dispatch&per_page=5" --jq "[.workflow_runs[] | select(.created_at >= \"$t0\")][0].id // empty"); [ -n "$id" ] && { echo "$id"; exit 0; }; done
    else
      # REST dispatch refused (this token: 403 "Resource not accessible by integration"; GitHub also wants the file on the default branch): push a request instead
      echo "workflow_dispatch refused ($(head -c 160 "$S2/.dispatch_err" | tr '\n' ' ')); pushing ci/request.json" >&2
      [ -d "$CL/.git" ] || "$0" init; cd "$CL"; git pull -q --rebase origin "$BR" || true; mkdir -p ci
      { printf '{"requested":"%s"' "$t0"; for k in "${!IN[@]}"; do printf ',"%s":%s' "$k" "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' -- "${IN[$k]}")"; done; printf '}\n'; } > ci/request.json
      git add ci/request.json; git commit -q -m "ci request: ${IN[mode]} ${IN[stages]} ${IN[decks]} ${IN[crit]} ${IN[name]}"; sha=$(git rev-parse HEAD)
      for i in 1 2 3; do git push -q origin "HEAD:refs/heads/$BR" 2>/dev/null && break; git pull -q --rebase origin "$BR"; sha=$(git rev-parse HEAD); done
      for i in $(seq 1 30); do sleep 4; id=$(api "repos/$OWNER/$REPO/actions/runs?branch=$BR&event=push&per_page=10" --jq "[.workflow_runs[] | select(.head_sha == \"$sha\")][0].id // empty"); [ -n "$id" ] && { echo "$id"; exit 0; }; done
    fi
    echo "dispatched; run id not visible yet" >&2; exit 1 ;;
  status)
    if [ -n "${1:-}" ]; then api "repos/$OWNER/$REPO/actions/runs/$1" --jq '"run \(.id) \(.status) \(.conclusion // "-") \(.created_at) -> \(.updated_at)"'
      api "repos/$OWNER/$REPO/actions/runs/$1/jobs?per_page=100" --jq '.jobs[] | "\(.name)\t\(.status)\t\(.conclusion // "-")\t\(.started_at)\t\(.completed_at // "-")"'
    else api "repos/$OWNER/$REPO/actions/runs?branch=$BR&per_page=10" --jq '.workflow_runs[] | "\(.id)\t\(.status)\t\(.conclusion // "-")\t\(.display_title)\t\(.created_at)"'; fi ;;
  wait)
    RUN="$1"; P="${2:-60}"; while :; do s=$(api "repos/$OWNER/$REPO/actions/runs/$RUN" --jq '.status + " " + (.conclusion // "-")'); echo "$(date -u +%T) $s"; [[ "$s" == completed* ]] && break; sleep "$P"; done ;;
  pull)
    [ -d "$CL/.git" ] || "$0" init; cd "$CL"; git pull -q --rebase origin "$BR"; mkdir -p "$S2/results"; tar -C "$CL/results" --exclude=./cache -cf - . | tar -C "$S2/results" -xf -; echo "results pulled into $S2/results ($(git log -1 --format='%h %s'))" ;;
  speed)
    RUN="$1"; api "repos/$OWNER/$REPO/actions/runs/$RUN/jobs?per_page=100" --jq '.jobs[] | "\(.name)\t\(.started_at)\t\(.completed_at // "-")"'
    [ -d "$CL/.git" ] && { cd "$CL"; git pull -q --rebase origin "$BR" || true; cat results/logs/bench_"$RUN"_*.json 2>/dev/null || true; } ;;
  *) sed -n 2,10p "$0" ;;
esac
