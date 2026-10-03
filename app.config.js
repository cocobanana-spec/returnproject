// app.json 위에 환경별로 달라지는 값만 얹는다. 지금은 웹 기본 경로 하나다
//
// 웹 앱이 어느 경로 밑에서 서빙되는지는 호스팅에 따라 다르다.
//   GitHub Pages (지금)      → /returnproject/app   (app.json 의 experiments.baseUrl)
//   Cloudflare Pages (이전 후) → /                    (app.ppurin.com 루트)
// Expo 는 experiments.baseUrl 을 번들에 인라인하므로 빌드 때 정해져야 한다. 두 호스팅을
// 같은 코드로 빌드하려고 WEB_BASE_URL 환경 변수로 덮어쓴다. 비우면(빈 문자열) 루트다.
//
//   WEB_BASE_URL=        npm run export:web   → 루트 (Cloudflare)
//   npm run export:web                        → app.json 값 (GitHub Pages)
//
// 이전이 끝나 GitHub Pages 를 접으면 app.json 의 baseUrl 을 지우고 이 파일도 지운다.
module.exports = ({ config }) => {
  const override = process.env.WEB_BASE_URL;
  if (override === undefined) return config;
  return {
    ...config,
    experiments: { ...(config.experiments ?? {}), baseUrl: override },
  };
};
