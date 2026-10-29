#!/usr/bin/env bash
# Simulates what a new user gets: clones the COMMITTED state of this repo into a temp
# folder, makes a brand-new virtualenv, installs the requirements, builds the page,
# and runs the test-suite (including a real server start).
#
#   scripts/clean_install_check.sh            # base install + tests
#   scripts/clean_install_check.sh --lean     # also installs PyPantograph and runs the Lean checks (slow)
#
# Uncommitted changes are NOT tested - commit first.
set -euo pipefail

WITH_LEAN=0
[ "${1:-}" = "--lean" ] && WITH_LEAN=1

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "== cloning $REPO"
git clone -q "$REPO" "$TMP/fsm"

echo "== new virtualenv ($(python3 --version))"
python3 -m venv "$TMP/venv"
# shellcheck disable=SC1091
. "$TMP/venv/bin/activate"
python -m pip install -q --upgrade pip

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
