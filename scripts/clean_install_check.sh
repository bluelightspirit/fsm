#!/usr/bin/env bash
# Simulates what a new user gets: clones this repo into a temp folder, makes a brand-new
# virtualenv, installs the requirements, builds the page, and runs the test-suite
# (including a real server start).
#
#   scripts/clean_install_check.sh                 # the LOCAL committed state (current branch)
#   scripts/clean_install_check.sh --remote        # the public remote, cloned the way a stranger
#                                                  # does it: default branch, nothing else
#   scripts/clean_install_check.sh --remote --lean # ...and also install PyPantograph and run the
#                                                  # Lean checks (slow, needs network and git)
#
# Local mode tests committed changes only (commit first) and cannot notice that GitHub's default
# branch is not the branch you work on; --remote can.
set -euo pipefail

WITH_LEAN=0
REMOTE=0
for arg in "$@"; do
  case "$arg" in
    --lean)   WITH_LEAN=1 ;;
    --remote) REMOTE=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ "$REMOTE" = 1 ]; then
  URL="$(git -C "$REPO" remote get-url origin)"
  echo "== cloning $URL exactly as a new user would (default branch)"
  git clone -q "$URL" "$TMP/fsm"
  echo "   landed on branch: $(git -C "$TMP/fsm" branch --show-current)"
else
  echo "== cloning local repo $REPO"
  git clone -q "$REPO" "$TMP/fsm"
fi

for needed in server.py requirements.txt build.py; do
  if [ ! -f "$TMP/fsm/$needed" ]; then
    echo "FAIL: $needed is missing from that clone. If this is --remote, GitHub's default branch" >&2
    echo "      is not the branch with the current code (Settings -> Branches -> Default branch)." >&2
    exit 1
  fi
done

echo "== new virtualenv ($(python3 --version))"
python3 -m venv "$TMP/venv"
# shellcheck disable=SC1091
. "$TMP/venv/bin/activate"

echo "== pip install -r requirements.txt"
python -m pip install -r "$TMP/fsm/requirements.txt"

if [ "$WITH_LEAN" = 1 ]; then
  echo "== pip install -r requirements-lean.txt"
  python -m pip install -r "$TMP/fsm/requirements-lean.txt"
  export FSM_TEST_LEAN=1
fi

cd "$TMP/fsm"
echo "== building the page"
python build.py

echo "== running tests"
python -m unittest discover -s tests -v

echo
echo "CLEAN INSTALL CHECK PASSED"
