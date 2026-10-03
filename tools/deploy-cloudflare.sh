#!/usr/bin/env bash
# 랜딩·처리방침과 웹 앱을 Cloudflare Workers 정적 자산으로 배포한다 (ppurin.com 이전 후의 배포 경로)
#
#   wrangler.site.jsonc : site/     → https://ppurin.com      (랜딩, 처리방침, 나중에 /i/{코드})
#   wrangler.app.jsonc  : dist/web  → https://app.ppurin.com  (웹 앱, 단일 페이지)
#
# 왜 둘로 나누나 — 랜딩은 정적이고 앱은 단일 페이지라 "없는 경로" 처리 규칙이 다르다. GitHub Pages
# 에서 "루트 404.html 이 앱이어야 한다"는 꼬임이 여기서 생겼다. 워커를 나누면 각자 규칙을 갖는다.
#
# wrangler 4.147 부터 Pages 가 Workers 에 흡수되어 `wrangler pages deploy` 대신 `wrangler deploy` 다.
# 커스텀 도메인은 설정 파일의 routes 가 선언하고, 도메인이 같은 계정에 있어 DNS 도 자동이다.
#
# 전제 — 한 번만 `npx wrangler login`.
# 사용법: tools/deploy-cloudflare.sh [site|app|all]   (기본 all)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
WHAT="${1:-all}"

deploy_site() {
  echo "== 랜딩·처리방침 → ppurin.com"
  npx wrangler deploy -c wrangler.site.jsonc
}

deploy_app() {
  echo "== 웹 앱 빌드 (루트 경로)"
  # 루트에서 서빙되므로 기본 경로를 비운다. app.config.js 가 이 변수를 읽는다.
  WEB_BASE_URL= npm run export:web
  test -f dist/web/index.html || { echo "dist/web/index.html 이 없다. 빌드 실패."; exit 1; }
  # 루트 빌드인지 다시 확인한다. 옛 경로가 남아 있으면 자원이 404 가 난다.
  if grep -q "/returnproject/app" dist/web/index.html; then
    echo "index.html 에 옛 경로(/returnproject/app)가 남아 있다. WEB_BASE_URL 이 안 먹었다."; exit 1
  fi
  echo "== 웹 앱 → app.ppurin.com"
  npx wrangler deploy -c wrangler.app.jsonc
}

case "$WHAT" in
  site) deploy_site ;;
  app)  deploy_app ;;
  all)  deploy_site; deploy_app ;;
  *) echo "사용법: $0 [site|app|all]"; exit 1 ;;
esac

echo ""
echo "배포 완료. 확인:"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://ppurin.com/"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://app.ppurin.com/records   # 200 이어야 한다"
