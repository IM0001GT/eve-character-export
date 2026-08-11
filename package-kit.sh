#!/usr/bin/env bash
# Build a clean shareable archive of the EVE Character Data Export kit.
# Never includes SSO secrets, tokens, dumps, bundles, or portrait data.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSION="${EVE_CHARACTER_EXPORT_VERSION:-${TQ_IMPORT_KIT_VERSION:-2.0.0}}"
NAME="eve-character-export-v${VERSION}"
# Legacy artifact name for people who still search for tq-import
LEGACY_NAME="evejs-tq-import-kit-v${VERSION}"
DIST_DIR="${REPO_ROOT}/dist"
STAGE="${DIST_DIR}/.stage-${NAME}"

INCLUDE_FILES=(
  eve-character-export.js
  tq-import.js
  package-kit.sh
  README.md
  GUIDE.md
  SCOPES.md
  NOTICE.md
)

INCLUDE_DIRS=(
  lib
)

echo "==> Packaging ${NAME}"
rm -rf "${STAGE}"
mkdir -p "${STAGE}/tq-import/lib" "${DIST_DIR}"

for f in "${INCLUDE_FILES[@]}"; do
  if [[ ! -f "${SCRIPT_DIR}/${f}" ]]; then
    echo "Missing required file: ${f}" >&2
    exit 1
  fi
  cp -a "${SCRIPT_DIR}/${f}" "${STAGE}/tq-import/"
done

for d in "${INCLUDE_DIRS[@]}"; do
  cp -a "${SCRIPT_DIR}/${d}/." "${STAGE}/tq-import/${d}/"
done

rm -rf \
  "${STAGE}/tq-import/_local" \
  "${STAGE}/tq-import/dumps" \
  "${STAGE}/tq-import/bundles" \
  "${STAGE}/tq-import/tokens" \
  "${STAGE}/tq-import/node_modules" \
  "${STAGE}/tq-import/.git" 2>/dev/null || true
find "${STAGE}" -type f \( \
  -name 'sso-config.json' -o \
  -name '*.sqlite' -o \
  -name '*token*.json' -o \
  -name '.env' -o \
  -name '.env.*' \
\) -delete 2>/dev/null || true

cat > "${STAGE}/tq-import/INSTALL.txt" <<'INST'
EVE Character Data Export
=========================

1. Place this folder at:  <your-tree>/tools/tq-import/
2. Read GUIDE.md and NOTICE.md.
3. Create your own app on developers.eveonline.com (see SCOPES.md).
4. Export your own character data:

     node tools/tq-import/eve-character-export.js setup
     node tools/tq-import/eve-character-export.js export --username myaccount
     node tools/tq-import/eve-character-export.js package --dump <export-id>

5. Optional — load the portable bundle into a local EveJS practice server:

     node tools/tq-import/eve-character-export.js import-evejs --bundle ...

Legacy entry point tq-import.js still works (same program).

Never commit or share _local/tq-import/ (tokens, dumps, SSO config).
INST

if grep -RInE 'IM000[0-9]|sk_[A-Za-z0-9]{10,}|eyJ[A-Za-z0-9_-]{20,}' \
  "${STAGE}/tq-import" \
  --include='*.md' --include='*.js' --include='*.txt' 2>/dev/null; then
  echo "WARNING: possible personal/sensitive strings found in stage (review above)." >&2
fi

chmod +x \
  "${STAGE}/tq-import/tq-import.js" \
  "${STAGE}/tq-import/eve-character-export.js" \
  "${STAGE}/tq-import/package-kit.sh"

TAR="${DIST_DIR}/${NAME}.tar.gz"
ZIP="${DIST_DIR}/${NAME}.zip"

tar -C "${STAGE}" -czf "${TAR}" tq-import
(
  cd "${STAGE}"
  if command -v zip >/dev/null 2>&1; then
    rm -f "${ZIP}"
    zip -qr "${ZIP}" tq-import
  fi
)

# Also publish under legacy archive names for existing links
cp -a "${TAR}" "${DIST_DIR}/${LEGACY_NAME}.tar.gz"
[[ -f "${ZIP}" ]] && cp -a "${ZIP}" "${DIST_DIR}/${LEGACY_NAME}.zip"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "${DIST_DIR}" && sha256sum "$(basename "${TAR}")" > "${NAME}.tar.gz.sha256")
  [[ -f "${ZIP}" ]] && (cd "${DIST_DIR}" && sha256sum "$(basename "${ZIP}")" > "${NAME}.zip.sha256")
  (cd "${DIST_DIR}" && sha256sum "${LEGACY_NAME}.tar.gz" > "${LEGACY_NAME}.tar.gz.sha256")
  [[ -f "${DIST_DIR}/${LEGACY_NAME}.zip" ]] && (cd "${DIST_DIR}" && sha256sum "${LEGACY_NAME}.zip" > "${LEGACY_NAME}.zip.sha256")
fi

rm -rf "${STAGE}"

echo
echo "Clean kit ready (no secrets / dumps / tokens):"
echo "  ${TAR}"
[[ -f "${ZIP}" ]] && echo "  ${ZIP}"
echo "  (also ${LEGACY_NAME}.* for older links)"
echo
echo "Install path: tools/tq-import/"
echo "Preferred CLI: node tools/tq-import/eve-character-export.js"
