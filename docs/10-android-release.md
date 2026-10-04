# 안드로이드 빌드와 Google Play 출시 절차

> EAS를 쓰지 않는다. `expo prebuild` 로 네이티브 프로젝트를 뽑고 Gradle 로 빌드해 Play Console 에 올린다.
> 2026-10-04 실제로 실행해 서명된 APK·AAB 생성까지 확인한 절차다. Play Console 쪽은 사장님 계정이 필요하다.

## 확정 값

| 항목 | 값 |
|---|---|
| 패키지 이름 | `com.cocobanana.ppurin` (iOS 번들 식별자와 같다. **한 번 올리면 못 바꾼다**) |
| 업로드 키 | `~/.ppurin/upload-keystore.jks`, 별칭 `ppurin-upload` (PKCS12, RSA 2048, 2054년까지) |
| 키 비밀번호 | `~/.ppurin/keystore.properties` 안 (저장소 밖. 권한 600) |
| 업로드 키 SHA-1 | `6F:73:F5:78:DA:3E:96:54:C1:D3:FD:90:1B:53:A0:2D:07:C5:4C:41` |
| versionCode | `app.json` → `expo.android.versionCode` (정수. 올릴 때마다 +1. 지금 2) |
| versionName | `expo.version` (iOS 와 같은 `1.0.1`) |
| 자바 | Android Studio 에 딸린 JBR 21 (`/Applications/Android Studio.app/Contents/jbr/Contents/Home`) |
| SDK | `~/Library/Android/sdk` |

## 키를 잃으면 끝이다

업로드 키로 서명한 AAB 만 Play 가 받는다. **키 파일(`upload-keystore.jks`)과 비밀번호 파일(`keystore.properties`)을
잃으면 이 앱은 영영 업데이트할 수 없다**(Play App Signing 을 켜 두면 Google 에 사정해서 키를 바꿀 수는 있지만 며칠 걸린다).

- 두 파일을 1Password(또는 키체인·외장 저장소)에 지금 백업한다. 저장소(git)에는 절대 넣지 않는다 — `.gitignore` 와 무관하게 `~/.ppurin` 은 프로젝트 밖이다.
- 다른 PC 에서 빌드하려면 같은 경로에 두 파일을 복원한다. 없으면 플러그인이 경고를 내고 debug 키로 서명한다(Play 가 거부한다).

## 순서

### 1. versionCode 를 올린다

같은 versionCode 는 두 번 올릴 수 없다. `app.json` 의 `expo.android.versionCode` 를 +1 한다. prebuild 가 `android/app/build.gradle` 로 옮긴다.

### 2. 네이티브 프로젝트를 뽑는다

```
npx expo prebuild --platform android --no-install
```

`android/` 는 gitignore 대상이며 언제든 다시 만들 수 있는 산출물이다. `plugins/withAndroidUploadSigning.js` 가 이때
`build.gradle` 의 release 서명을 업로드 키로 바꾼다. 결과를 확인한다.

```
grep -n "signingConfigs.upload" android/app/build.gradle   # 한 줄 나와야 한다
```

### 3. 빌드

```
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android && ./gradlew assembleRelease bundleRelease --no-daemon
```

- APK: `android/app/build/outputs/apk/release/app-release.apk` — 에뮬레이터·실기기 설치용
- AAB: `android/app/build/outputs/bundle/release/app-release.aab` — **Play 에 올리는 것은 이것**
- 첫 빌드는 의존성 내려받기 때문에 30분 넘게 걸린다. 네트워크 순단으로 한 번 실패하면 그냥 다시 돌린다(2026-10-04 겪음).

서명이 업로드 키인지 확인한다.

```
"$JAVA_HOME/bin/keytool" -printcert -jarfile android/app/build/outputs/apk/release/app-release.apk | grep SHA1
# 위 표의 SHA-1 과 같아야 한다
```

### 4. 에뮬레이터에서 켜 본다

```
~/Library/Android/sdk/emulator/emulator -avd Pixel7_A16 &
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.cocobanana.ppurin/.MainActivity
adb exec-out screencap -p > /tmp/android.png
```

서명 키가 바뀌면(debug → 업로드) `adb install -r` 이 거부한다. `adb uninstall com.cocobanana.ppurin` 뒤에 설치한다.

### 5. Play Console — 사장님이 할 일

1. https://play.google.com/console 에서 개발자 계정 등록(개인사업자. 25달러 1회. 신분·사업자 확인에 며칠 걸릴 수 있다).
2. **앱 만들기** → 이름 `뿌린대로거두리라`, 기본 언어 한국어, 앱/무료.
3. **Play App Signing** 은 기본으로 켜진다(Google 이 서명 키를 보관하고, 우리 키는 '업로드 키'가 된다). 그대로 둔다.
4. **테스트 → 내부 테스트** 에 AAB 를 올린다. 테스터 메일(사장님·사모님)을 넣으면 바로 설치 링크가 나온다. iOS 의 TestFlight 자리다.
5. 스토어 등록정보: 문안·스크린샷은 `docs/06-store-listing.md` 와 같은 것을 쓴다. 안드로이드 스크린샷은 에뮬레이터 `screencap` 으로 뽑는다(최소 2장, 16:9 또는 9:16).
6. **데이터 보안(Data safety)** — iOS App Privacy 와 같은 6가지(이메일·이름·사진·기록 내용·기기 식별자·사용 데이터). 수집 목적은 앱 기능, 전송 암호화 예, 삭제 요청 가능 예.
7. 콘텐츠 등급 설문, 타깃 연령(18세 이상 권장 — 금전 기록), 광고 없음, 개인정보처리방침 URL `https://ppurin.com/privacy`.
8. 2024년 11월 이후 **개인 개발자 계정은 프로덕션 전에 비공개 테스트 20명·14일** 요건이 있다. 개인사업자로 등록하면 '조직' 계정으로 이 요건이 없다 — 등록할 때 조직을 고른다.

### 6. 올린 뒤

- 내부 테스트 링크로 두 분 폰에 설치해 iOS 와 같은 항목을 본다(로그인·기록·사진·OCR·공동 관리).
- 구글 로그인은 Supabase OAuth(브라우저) 방식이라 SHA-1 등록이 필요 없다. 애플 로그인도 같은 방식이라 안드로이드에서도 뜬다.
- 딥링크 `ppurin://` 는 prebuild 가 매니페스트에 넣는다. 로그인 뒤 앱으로 돌아오는 것이 이걸로 된다.

## 아직 안 한 것

- `expo-system-ui` 가 없어 `userInterfaceStyle` 이 안드로이드에서 안 먹는다. 앱 화면은 토큰이 라이트로 고정이라 영향은 네이티브 날짜 선택기 색 정도다. 다음 네이티브 변경 때 같이 넣는다.
- 실기기 확인. 에뮬레이터만 봤다.
