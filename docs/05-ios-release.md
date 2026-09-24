# iOS 빌드와 TestFlight 업로드 절차

> EAS를 쓰지 않는다. Xcode 명령줄 도구만으로 아카이브하고 App Store Connect에 올린다.
> 2026-09-24 실제로 실행해 아카이브·서명·IPA 생성까지 확인한 절차다.

## 확정 값

| 항목 | 값 |
|---|---|
| 번들 식별자 | `com.cocobanana.ppurin` |
| 팀 식별자 | `58XF2TVK7G` |
| 워크스페이스 | `ios/app.xcworkspace` (prebuild가 만든다) |
| 스킴 | `app` |

**팀 식별자를 인증서 이름에서 읽지 마라.** `Apple Development: 이름 (XXXXXXXXXX)`의 괄호 안은 인증서 자체의 식별자이지 팀 식별자가 아니다. 팀 식별자는 인증서 주체의 OU 필드다.

```
security find-certificate -a -c "Apple Development" -p | openssl x509 -noout -subject
# subject=UID=..., CN=Apple Development: ... (Y7U3S84HW6), OU=58XF2TVK7G, ...
#                                                            ^^^^^^^^^^ 이쪽이 팀 식별자
```

## 순서

### 1. 빌드 번호를 올린다

같은 번호는 두 번 올릴 수 없다. `app.json`의 `expo.ios.buildNumber`를 올린다. prebuild가 이 값을 `CURRENT_PROJECT_VERSION`으로 옮긴다. 네이티브 프로젝트를 직접 고치면 다음 prebuild에서 날아간다.

### 2. 네이티브 프로젝트를 뽑고 의존성을 설치한다

```
npx expo prebuild --platform ios --no-install
cd ios && pod install && cd ..
```

`ios/`는 gitignore 대상이며 언제든 다시 만들 수 있는 산출물이다.

### 3. 아카이브

CocoaPods를 쓰므로 `-project`가 아니라 **`-workspace`** 를 넘겨야 한다.

```
xcodebuild -workspace ios/app.xcworkspace -scheme app -configuration Release \
  -destination 'generic/platform=iOS' -archivePath /tmp/ppurin.xcarchive \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=58XF2TVK7G archive
```

`DEVELOPMENT_TEAM`을 넘기지 않으면 prebuild가 만든 프로젝트에 팀이 비어 있어 프로비저닝 프로파일을 못 찾는다. `-allowProvisioningUpdates`가 Xcode에 로그인된 계정으로 인증서와 프로파일을 발급한다. App Store Connect API 키는 필요 없다.

### 4. 서명만 먼저 확인한다

`ExportOptions.plist`의 `destination`을 `export`로 두고 돌리면 업로드 없이 IPA만 나온다.

```
xcodebuild -exportArchive -archivePath /tmp/ppurin.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath /tmp/ppurin-out \
  -allowProvisioningUpdates
```

`** EXPORT SUCCEEDED **`와 `app.ipa`가 나오면 서명은 끝난 것이다.

### 5. 업로드

`destination`을 `upload`로 바꾸고 같은 명령을 다시 돌린다. 로그 끝에 `Upload succeeded.`가 떠야 한다.

## 전제 조건

- Xcode에 애플 ID가 로그인돼 있어야 한다.
- **App Store Connect에 이 번들 식별자로 앱 레코드가 먼저 있어야 한다.** 없으면 4단계까지 전부 성공하고 업로드에서만 실패한다.

```
App record with bundle identifier "com.cocobanana.ppurin" not found on App Store Connect.
```

앱 레코드는 appstoreconnect.apple.com → 앱 → 추가에서 만든다. 플랫폼 iOS, 기본 언어 한국어, 번들 ID는 목록에서 고르고, SKU는 아무 고유 문자열이면 된다.

## 자주 걸리는 것

| 증상 | 원인 |
|---|---|
| `No Account for Team "XXXX"` | 팀 식별자가 틀렸다. 인증서 OU를 확인하라 |
| `No profiles for '...' were found` | 위와 같은 원인이거나 `-allowProvisioningUpdates`가 빠졌다 |
| `App record ... not found` | App Store Connect에 앱 레코드가 없다 |
| 업로드는 됐는데 TestFlight에 안 보임 | 처리에 몇 분 걸린다. 수출 규정 답변이 필요할 수 있다 |

## App Store 등록 정보 (확정 2026-09-24)

검색에 색인되는 칸은 이름·부제·키워드 셋이다. 같은 단어를 두 번 쓰면 자리만 낭비하므로 셋 사이에 중복을 두지 않는다.

| 칸 | 값 | 글자 수 |
|---|---|---|
| 이름 | `뿌린대로거두리라 - 축의금 경조사비` | 19 / 30 |
| 부제 | `결혼식 돌잔치 장례식 부조금 장부` | 18 / 30 |
| 기본 언어 | 한국어 | |
| SKU | `ppurin-001` | |
| 번들 ID | `com.cocobanana.ppurin` | |

키워드 칸(100자, 사용자에게 보이지 않음)

```
경조사,축의금,부조금,조의금,결혼식,돌잔치,장례식,경조사비,가계부,장부,회비,하객,답례
```

브랜드 이름은 아무도 검색하지 않는다. 출시 초기 유입은 사실상 전부 검색이므로 사람들이 실제로 치는 말을 이름과 부제에 최대한 담았다. 무엇을 해 주는 앱인지는 스크린샷 첫 장에서 알린다. 부부 공동 장부가 경쟁 앱에 없는 기능이므로 그 자리에 넣는다.

청첩장은 2단계 기능이라 키워드에 넣지 않는다. 구현하지 않은 기능을 등록 정보에 적으면 심사에서 걸린다.

## 수출 규정

앱이 표준 HTTPS만 쓰므로 면제 대상이다. `app.json`의 `expo.ios.config.usesNonExemptEncryption`을 false로 두어 업로드마다 묻지 않게 했다. 나중에 자체 암호화를 넣으면 이 값을 다시 판단해야 한다.

## 앱 아이콘

원본 세트는 `icons/`에 있다. 앱에 실제로 쓰는 것은 `assets/`로 복사한 여섯 개이며, `app.json`이 그쪽을 가리킨다.

| 용도 | 파일 |
|---|---|
| iOS 기본 | `assets/icon.png` |
| iOS 다크 | `assets/icon-dark.png` |
| iOS 틴티드 | `assets/icon-tinted.png` |
| 안드로이드 전경 | `assets/android-icon-foreground.png` |
| 안드로이드 단색 | `assets/android-icon-monochrome.png` |
| 안드로이드 배경색 | `#FFF8E8` |

**스토어용 1024 아이콘에는 알파 채널이 있으면 안 된다.** 원본은 RGBA지만 prebuild가 기본 아이콘을 RGB로 눕혀서 내보낸다. 다크 변형은 알파를 유지하는 것이 정상이다. 시스템이 배경 위에 합성하기 때문이다. 확인하려면 생성된 파일의 PNG 색 타입을 본다. 2면 알파 없음, 6이면 알파 있음이다.

```
python3 -c "
import struct, glob
for p in sorted(glob.glob('ios/app/Images.xcassets/AppIcon.appiconset/*.png')):
    d=open(p,'rb').read(); w,h,bd,ct=struct.unpack('>IIBB', d[16:26])
    print(p.split('/')[-1], w, ct)
"
```

안드로이드 전경 이미지는 432px이다. Expo 권장은 1024px이므로 안드로이드를 실제로 낼 때 더 큰 원본으로 교체한다.

## iOS 27 장면 수명주기 (반드시 필요)

iOS 27 SDK로 빌드한 앱이 장면(UIScene) 수명주기를 채택하지 않으면 **실행 40ms 만에 죽는다.** 크래시 로그에 이렇게 찍힌다.

```
Exception Type:  EXC_BREAKPOINT (SIGTRAP)
0  UIKitCore  ___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke
```

TestFlight 빌드 1.0.0(2)가 실제로 이 이유로 죽었다. 시뮬레이터는 이 규칙을 강제하지 않으므로 **시뮬레이터에서 아무리 돌려도 드러나지 않는다.** 실기기나 TestFlight에서만 보인다.

Expo SDK 57의 prebuild 템플릿은 아직 장면을 채택하지 않는다. 다만 expo 57.0.24 패키지 안에 필요한 조각(`ExpoAppSceneDelegate`, `ExpoReactNativeFactoryProvider`)이 이미 들어 있어 연결만 하면 된다. `plugins/withIosSceneLifecycle.js`가 그 일을 한다.

- Info.plist에 `UIApplicationSceneManifest`를 넣고 델리게이트로 `EXExpoAppSceneDelegate`를 지정한다.
- `AppDelegate.swift`가 `ExpoReactNativeFactoryProvider`를 채택하게 하고, 창 생성과 React Native 시작을 지운다. 그 일은 장면 델리게이트가 한다.

두 파일 모두 prebuild가 다시 만들기 때문에 손으로 고치면 다음 prebuild에서 날아간다. 그래서 설정 플러그인으로 두었다. **Expo SDK 58부터는 기본으로 채택되므로 그때 이 플러그인을 지운다.**

## 실기기에서 바로 확인하는 법

TestFlight를 거치지 않고 붙어 있는 기기에 설치해 확인할 수 있다. 실행 직후 죽는 유형은 이 방법이 훨씬 빠르다.

```
xcodebuild -workspace ios/app.xcworkspace -scheme app -configuration Release \
  -destination 'id=<기기 UDID>' -derivedDataPath /tmp/ppurin-dev \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=58XF2TVK7G build

xcrun devicectl device install app --device <기기 UDID> /tmp/ppurin-dev/Build/Products/Release-iphoneos/app.app
xcrun devicectl device process launch --device <기기 UDID> com.cocobanana.ppurin

# 몇 초 뒤 프로세스가 살아 있는지 본다. 목록에 없으면 죽은 것이다.
xcrun devicectl device info processes --device <기기 UDID> | grep app.app
```

기기 UDID는 `xcrun devicectl list devices`로 확인한다.
