#!/usr/bin/env bash
# Copy the course code into course/, which scripts/build-images.sh installs
# under /home/student in the guest:
#   Codes/weekNN          -> course/weekNN          -> ~/weekNN
#   Sample/sample{1,2,4}  -> course/sample/sampleN  -> ~/sample/sampleN
# sample3 (Naver news API) needs the network, which the guest does not have;
# Sample/README.md and verify.py cover all four samples, so they stay out too.
#
#   scripts/sync-course.sh [path/to/2026_BasicProgrammingUsingPython]
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COURSE="${1:-$REPO_DIR/../2026_BasicProgrammingUsingPython}"
EXCLUDES=(--exclude '.DS_Store' --exclude '.gitkeep' --exclude '__pycache__/'
	--exclude '*.zip' --exclude '*.ipynb' --exclude '.venv/' --exclude 'instance/')
rsync -a --delete --prune-empty-dirs "${EXCLUDES[@]}" --exclude '/sample/' \
	"$COURSE/Codes/" "$REPO_DIR/course/"
mkdir -p "$REPO_DIR/course/sample"
for s in sample1 sample2 sample4; do
	rsync -a --delete "${EXCLUDES[@]}" "$COURSE/Sample/$s/" "$REPO_DIR/course/sample/$s/"
done
echo "course/: $(find "$REPO_DIR/course" -type f | wc -l | tr -d ' ') files from $COURSE"
