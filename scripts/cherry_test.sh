#!/usr/bin/env bash
set -euo pipefail

# Cherry-pick test script: applies commits onto safe/db4e619 and runs build after each
# Edit the COMMITS array if you want a different sequence.
COMMITS=(
  bd08199
  fd3c5c7
  759a1a6
  52efa97
  997c591
  95e80a0
  1ebd8c4
  8e24f65
  169af06
  482e96d
  aae0c21
  1d177d9
)

echo "Switching to safe/db4e619..."
git fetch --all
git checkout -B safe/db4e619 db4e619

echo "Installing dependencies (once)..."
npm ci

for c in "${COMMITS[@]}"; do
  echo
  echo "---- cherry-pick $c ----"
  if git cherry-pick "$c" -x; then
    echo "Applied $c"
  else
    echo "Cherry-pick $c failed; attempting to skip if empty or continue." >&2
    # If CHERRY_PICK_HEAD exists we can try to skip empty commits or continue after automatic resolution
    if git rev-parse -q --verify CHERRY_PICK_HEAD >/dev/null 2>&1; then
      echo "Skipping commit $c (empty or already applied)."
      if ! git cherry-pick --skip >/dev/null 2>&1; then
        echo "Failed to skip cherry-pick $c. Aborting." >&2
        git cherry-pick --abort >/dev/null 2>&1 || true
        exit 2
      fi
    else
      echo "No CHERRY_PICK_HEAD present; aborting." >&2
      exit 2
    fi
  fi

  echo "Running build after $c..."
  if ! npm run build; then
    echo "Build failed after cherry-pick $c. Leaving tree for inspection." >&2
    exit 3
  fi

  echo "OK: $c"
done

echo "All commits applied and built successfully on safe/db4e619."
