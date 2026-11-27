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
# A fresh Agave ledger needs the same standard program IDs used by the client.
fetch_program() {
  local repo="$1" tag="$2" binary="$3" digest="$4"
  curl --fail --silent --show-error --location --retry 3 \
    "https://github.com/solana-program/$repo/releases/download/$tag/$binary" -o "$assets/$binary"
  echo "$digest  $assets/$binary" | sha256sum --check
}
fetch_program token program@v3.5.0 spl_token.so 18264f491c7e0ad056dd36f42f8de6d1fedf9f044d1f521e714b4dc6b61594b6
fetch_program associated-token-account program@v1.1.2 spl_associated_token_account.so 9ba8d4dfec9ca6ba8480f7f4edcc1a90184271db44e238ea0f09bba47ad2d8a9
fetch_program memo program@v3.0.0 spl_memo.so f520eaf096361abbb9639ea4dc3e5388a87b9330e121f476607b87c46ef67954
export SOLANA_TEST_PROGRAM_DIR="$assets"
node --test integration/payout-runtime.mjs integration/payouts.mjs
