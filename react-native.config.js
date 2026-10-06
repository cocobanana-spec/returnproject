// 시뮬레이터 빌드에서만 ML Kit(OCR)을 뺀다 — Google MLKit 은 arm64 시뮬레이터 슬라이스가 없어 빌드가 막힌다
//
// 기기·TestFlight 빌드는 그대로다(환경 변수 없음). 시뮬레이터 미리보기가 필요할 때만:
//   PPURIN_SKIP_MLKIT=1 pod install   (ios/ 에서)  → 시뮬레이터 빌드 → 끝나면 pod install 로 되돌린다
// 이 상태에서 '사진에서 읽기'를 누르면 네이티브 모듈이 없어 실패한다. 미리보기 용도다.
const skipMlKit = process.env.PPURIN_SKIP_MLKIT === '1';
module.exports = {
  dependencies: skipMlKit ? { '@react-native-ml-kit/text-recognition': { platforms: { ios: null } } } : {},
};
