#!/usr/bin/env bash
# 랜딩·처리방침과 웹 앱을 Cloudflare Pages 두 프로젝트에 배포한다 (ppurin.com 이전 후의 배포 경로)
#
# 프로젝트
#   ppurin-site : site/      → https://ppurin.com      (랜딩, 처리방침, 나중에 /i/{코드} 공개 페이지)
#   ppurin-app  : dist/web   → https://app.ppurin.com  (웹 앱, 단일 페이지)
#
# 왜 둘로 나누나 — 랜딩은 정적이고 앱은 단일 페이지라 404 폴백 규칙이 다르다. GitHub Pages 에서
# "루트 404.html 이 앱이어야 한다"는 꼬임이 여기서 생겼다. 프로젝트를 나누면 각자 _redirects 를 갖는다.
#
# 전제 — 한 번만: `npx wrangler login` (브라우저에서 Cloudflare 로그인). 프로젝트 생성도 한 번만:
#   npx wrangler pages project create ppurin-site --production-branch main
#   npx wrangler pages project create ppurin-app  --production-branch main
# 그 뒤 대시보드 Pages → 각 프로젝트 → Custom domains 에서 ppurin.com / app.ppurin.com 을 붙인다.
#
# 사용법: tools/deploy-cloudflare.sh [site|app|all]   (기본 all)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
WHAT="${1:-all}"

deploy_site() {
  echo "== 랜딩·처리방침 → ppurin-site"
  # /privacy.html 과 /privacy 둘 다 열리게 한다. 심사에 낸 옛 주소 형식을 지키기 위해서다.
  printf '/privacy.html /privacy 301\n' > site/_redirects
  npx wrangler pages deploy site --project-name ppurin-site --commit-dirty=true
}

deploy_app() {
  echo "== 웹 앱 빌드 (루트 경로)"
  # 루트에서 서빙되므로 기본 경로를 비운다. app.config.js 가 이 변수를 읽는다.
  WEB_BASE_URL= npm run export:web
  test -f dist/web/index.html || { echo "dist/web/index.html 이 없다. 빌드 실패."; exit 1; }
  # 단일 페이지 앱 폴백. /records 같은 주소로 직접 들어와도 index.html 을 200 으로 준다.
  # GitHub Pages 의 404.html 복사와 같은 역할인데, 여기서는 정식 기능이다.
  printf '/* /index.html 200\n' > dist/web/_redirects
  echo "== 웹 앱 → ppurin-app"
  npx wrangler pages deploy dist/web --project-name ppurin-app --commit-dirty=true
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
