#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSION="${EVE_CHARACTER_EXPORT_VERSION:-2.0.0}"
NAME="eve-character-export-v${VERSION}"
DIST="${REPO_ROOT}/dist"
STAGE="${DIST}/.stage-${NAME}"

rm -rf "${STAGE}"
mkdir -p "${STAGE}/eve-character-export/lib" "${DIST}"

cp -a \
  "${SCRIPT_DIR}/eve-character-export.js" \
  "${SCRIPT_DIR}/package-kit.sh" \
  "${SCRIPT_DIR}/README.md" \
  "${SCRIPT_DIR}/GUIDE.md" \
  "${SCRIPT_DIR}/NOTICE.md" \
  "${SCRIPT_DIR}/SCOPES.md" \
  "${STAGE}/eve-character-export/"
cp -a "${SCRIPT_DIR}/lib/." "${STAGE}/eve-character-export/lib/"

# Refuse EveJS / private-server wording in the export kit
if grep -RInE 'EveJS|evejs|offline server|private server|sandbox|tq-import|import-evejs' \
  "${STAGE}/eve-character-export" \
  --include='*.md' --include='*.js' --include='*.txt' 2>/dev/null; then
  echo "ERROR: forbidden product references found in export kit" >&2
  exit 1
fi

cat > "${STAGE}/eve-character-export/INSTALL.txt" <<'INST'
EVE Character Data Export
=========================

1. Place this folder at:  <project>/tools/eve-character-export/
2. Read GUIDE.md and NOTICE.md
3. Create your own app on developers.eveonline.com (SCOPES.md)
4. node tools/eve-character-export/eve-character-export.js setup
5. node tools/eve-character-export/eve-character-export.js export --username myaccount

Never share _local/eve-character-export/ (tokens, exports, SSO config).
INST

chmod +x "${STAGE}/eve-character-export/eve-character-export.js" "${STAGE}/eve-character-export/package-kit.sh"

tar -C "${STAGE}" -czf "${DIST}/${NAME}.tar.gz" eve-character-export
python3 - <<PY
import pathlib, zipfile
stage = pathlib.Path("${STAGE}")
out = pathlib.Path("${DIST}/${NAME}.zip")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    root = stage / "eve-character-export"
    for path in root.rglob("*"):
        if path.is_file():
            zf.write(path, path.relative_to(stage).as_posix())
print(out)
PY
(cd "${DIST}" && sha256sum "${NAME}.tar.gz" > "${NAME}.tar.gz.sha256" && sha256sum "${NAME}.zip" > "${NAME}.zip.sha256")
rm -rf "${STAGE}"
echo "Wrote ${DIST}/${NAME}.tar.gz and .zip"
