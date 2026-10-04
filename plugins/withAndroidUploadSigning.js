// 안드로이드 릴리즈 서명을 사장님 PC 의 업로드 키(~/.ppurin/keystore.properties)로 바꾸는 설정 플러그인
//
// prebuild 가 만드는 android/app/build.gradle 은 release 도 debug 키로 서명한다. Play 에 올리려면
// 우리 키여야 한다. android/ 는 gitignore 라 손으로 고치면 다음 prebuild 에 날아가므로 플러그인으로 넣는다.
//
// 키 파일과 비밀번호는 저장소 밖(~/.ppurin/)에 둔다. 파일이 없으면 아무것도 바꾸지 않는다(debug 서명 그대로) —
// 다른 PC 에서도 빌드는 되게. **키를 잃으면 Play 앱을 다시 업데이트할 수 없다.** 백업은 사장님 몫.
const { withAppBuildGradle } = require('expo/config-plugins');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROPS = path.join(os.homedir(), '.ppurin', 'keystore.properties');

function withAndroidUploadSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!fs.existsSync(PROPS)) {
      console.warn(`[withAndroidUploadSigning] ${PROPS} 가 없어 release 를 debug 키로 서명한다`);
      return cfg;
    }
    let gradle = cfg.modResults.contents;
    if (gradle.includes('signingConfigs.upload')) return cfg;
    gradle = gradle.replace(
      /signingConfigs \{\n(\s+)debug \{/,
      (m, indent) =>
        `signingConfigs {\n${indent}upload {\n` +
        `${indent}    def props = new Properties()\n` +
        `${indent}    file('${PROPS}').withInputStream { props.load(it) }\n` +
        `${indent}    storeFile file(props['storeFile'])\n` +
        `${indent}    storePassword props['storePassword']\n` +
        `${indent}    keyAlias props['keyAlias']\n` +
        `${indent}    keyPassword props['keyPassword']\n` +
        `${indent}}\n${indent}debug {`,
    );
    gradle = gradle.replace(
      /release \{\n(\s+)\/\/ Caution!.*\n\s+\/\/ see .*\n\s+signingConfig signingConfigs\.debug/,
      (m, indent) => `release {\n${indent}signingConfig signingConfigs.upload`,
    );
    if (!gradle.includes('signingConfig signingConfigs.upload')) {
      throw new Error('[withAndroidUploadSigning] build.gradle 의 release 서명 자리를 찾지 못했다. 템플릿이 바뀌었는지 보라.');
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
}

module.exports = withAndroidUploadSigning;
