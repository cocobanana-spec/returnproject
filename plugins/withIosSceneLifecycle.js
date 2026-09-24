// iOS 장면(UIScene) 수명주기를 채택하게 하는 설정 플러그인 — 없으면 iOS 27에서 앱이 실행 즉시 죽는다
//
// 배경. iOS 27 SDK로 빌드한 앱이 장면 수명주기를 채택하지 않으면 UIKit이 실행 40ms 만에
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption 에서 SIGTRAP을 낸다.
// TestFlight 빌드 1.0.0(2)가 실기기에서 이 이유로 죽었다.
//
// Expo SDK 57의 prebuild 템플릿은 아직 장면을 채택하지 않는다. AppDelegate가
// didFinishLaunching에서 UIWindow를 직접 만들고 React Native를 띄운다.
// 다만 expo 57.0.24 패키지 안에는 필요한 조각이 이미 들어 있다(ExpoAppSceneDelegate,
// ExpoReactNativeFactoryProvider). 그것을 연결해 주기만 하면 된다.
//
// 이 플러그인이 하는 일은 두 가지다.
//   1. Info.plist에 UIApplicationSceneManifest를 넣고 델리게이트로 EXExpoAppSceneDelegate를 지정한다.
//   2. AppDelegate.swift가 ExpoReactNativeFactoryProvider를 채택하게 하고,
//      창 생성과 React Native 시작을 지운다. 그 일은 이제 장면 델리게이트가 한다.
//
// 두 파일 모두 prebuild가 다시 만들기 때문에 손으로 고치면 다음 prebuild에서 날아간다.
// Expo SDK 58부터는 기본으로 채택되므로 그때 이 플러그인을 지운다.
const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');

const SCENE_DELEGATE = 'EXExpoAppSceneDelegate';

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE,
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneAwareAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error(
        `withIosSceneLifecycle: AppDelegate가 swift가 아니다(${cfg.modResults.language}). 템플릿이 바뀌었는지 확인하라.`,
      );
    }

    let contents = cfg.modResults.contents;

    // (1) 프로토콜 채택. 장면 델리게이트가 AppDelegate에서 팩토리와 창을 가져간다.
    const classLine = 'class AppDelegate: ExpoAppDelegate {';
    if (contents.includes(classLine)) {
      contents = contents.replace(
        classLine,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
    } else if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      throw new Error(
        'withIosSceneLifecycle: AppDelegate 클래스 선언을 찾지 못했다. 템플릿이 바뀌었는지 확인하라.',
      );
    }

    // (2) 창 생성과 React Native 시작을 제거한다. 장면 델리게이트가 대신 한다.
    //     남겨 두면 창이 두 개 생기고 장면에 붙지 않은 쪽이 화면을 가린다.
    const startBlock = /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?\)\s*\n#endif\n/;
    if (startBlock.test(contents)) {
      contents = contents.replace(
        startBlock,
        '    // 창 생성과 React Native 시작은 ExpoAppSceneDelegate가 맡는다(plugins/withIosSceneLifecycle.js).\n',
      );
    } else if (contents.includes('factory.startReactNative(')) {
      throw new Error(
        'withIosSceneLifecycle: startReactNative 블록 모양이 예상과 다르다. 템플릿이 바뀌었는지 확인하라.',
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  return withSceneAwareAppDelegate(withSceneManifest(config));
};
