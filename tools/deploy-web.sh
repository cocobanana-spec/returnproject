#!/usr/bin/env bash
# 웹 앱을 GitHub Pages(gh-pages 브랜치)에 배포한다 — 빌드부터 폴백 배치까지 한 번에
#
# 배포 구조
#   gh-pages 루트 : privacy.html (처리방침), index.html (처리방침으로 보냄), 404.html (= 웹 앱)
#   gh-pages /app : 웹 앱 본체
#
# **루트 404.html이 웹 앱이어야 한다.** 단일 페이지 앱이라 /app/records 같은 주소로 직접
# 들어오거나 새로고침하면 그 경로의 파일이 없다. GitHub Pages는 없는 경로에 **사이트 루트의**
# 404.html을 준다. 하위 폴더의 404.html은 쓰지 않는다 — app/404.html만 두었더니 새로고침이
# 그대로 404였다(2026-09-26 실측). 앱 HTML이 자원을 절대 경로로 참조하므로 어느 주소로
# 404가 떠도 자원은 정상적으로 불린다.
#
# 사용법: tools/deploy-web.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="https://github.com/cocobanana-spec/returnproject.git"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"

echo "== 1/3 웹 빌드"
npm run export:web

test -f dist/web/index.html || { echo "dist/web/index.html 이 없다. 빌드 실패."; exit 1; }

echo "== 2/3 gh-pages 받아오기"
git clone -q --branch gh-pages --depth 1 "$REPO" "$WORK/pages"

echo "== 3/3 파일 배치"
rm -rf "$WORK/pages/app"
cp -R dist/web "$WORK/pages/app"
# 사이트 루트 폴백. 이것이 빠지면 새로고침과 인증 복귀가 전부 404다.
cp dist/web/index.html "$WORK/pages/404.html"

cd "$WORK/pages"
if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
  echo "바뀐 것이 없다. 배포하지 않는다."
  exit 0
fi

NAME="$(git -C "$ROOT" config user.name)"
MAIL="$(git -C "$ROOT" config user.email)"
git add -A
git -c user.name="$NAME" -c user.email="$MAIL" commit -q -m "웹 앱 배포"
git push -q origin gh-pages

echo "배포 완료"
echo "  앱        https://cocobanana-spec.github.io/returnproject/app/"
echo "  처리방침   https://cocobanana-spec.github.io/returnproject/privacy.html"
echo ""
echo "반영까지 1~2분 걸린다. 확인:"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://cocobanana-spec.github.io/returnproject/app/"
