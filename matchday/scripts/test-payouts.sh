#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
assets=$(mktemp -d)
trap 'rm -rf -- "$assets"' EXIT

# Verify the release artifact before executing the validator.
if [[ -z ${SOLANA_TEST_VALIDATOR:-} ]]; then
  archive="$assets/agave.tar.bz2"
  curl --fail --silent --show-error --location --retry 3 \
    'https://github.com/anza-xyz/agave/releases/download/v4.4.1/solana-release-x86_64-unknown-linux-gnu.tar.bz2' -o "$archive"
  echo "5b0f0fc7e4eedace05f6455de00aa1f2f3d1642068f1e8d50760ba49112c3941  $archive" | sha256sum --check
  tar -xjf "$archive" -C "$assets"
  export SOLANA_TEST_VALIDATOR="$assets/solana-release/bin/solana-test-validator"
fi
"$SOLANA_TEST_VALIDATOR" --version
node --test integration/payouts.mjs
