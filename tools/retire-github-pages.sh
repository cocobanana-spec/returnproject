#!/usr/bin/env bash
# 이전이 끝난 뒤 옛 GitHub Pages 를 "새 주소로 가세요" 안내 페이지로 바꾼다 — 한 번만 실행한다
#
# **실행 조건** — ppurin.com 과 app.ppurin.com 이 실제로 열리고, Supabase Redirect URLs 와
# App Store Connect 의 처리방침 주소를 새 주소로 바꾼 뒤에만 돌린다. 먼저 돌리면 옛 주소로
# 들어온 사용자가 아직 없는 곳으로 보내진다. 안내 페이지는 최소 6개월 둔다.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="https://github.com/cocobanana-spec/returnproject.git"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
cd "$ROOT"

for u in https://ppurin.com/ https://app.ppurin.com/ https://ppurin.com/privacy; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$u" || echo 000)"
  [ "$code" = "200" ] || { echo "새 주소가 아직 안 열린다: $u ($code). 중단."; exit 1; }
done

git clone -q --branch gh-pages --depth 1 "$REPO" "$WORK/pages"
cd "$WORK/pages"
git rm -rq . >/dev/null 2>&1 || true
cp -R "$ROOT/site-legacy/." .
NAME="$(git -C "$ROOT" config user.name)"; MAIL="$(git -C "$ROOT" config user.email)"
git add -A
git -c user.name="$NAME" -c user.email="$MAIL" commit -q -m "옛 주소를 ppurin.com 안내 페이지로 바꾼다"
git push -q origin gh-pages
echo "완료. 옛 주소는 이제 새 주소로 안내한다."
