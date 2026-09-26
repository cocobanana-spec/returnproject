// 넓은 화면(PC 브라우저)에서 내용이 가로로 퍼지지 않게 폭을 묶는 스타일
//
// 이 앱의 화면은 전부 전화기 세로를 전제로 만들었다. 1920px 브라우저에서 그대로 늘리면
// 한 줄이 화면 끝까지 가서 읽을 수 없다. **전면 재설계 대신 폭만 묶는다.**
// 720은 전화기(약 390)보다 넉넉해 목록에 숨 쉴 자리가 생기면서도, 한 줄이 눈으로 훑을 수 있는
// 길이를 넘지 않는 값이다. 하단 탭도 같은 폭 안에 들어가 데스크톱에서 네 개가
// 화면 양끝까지 흩어지지 않는다.
//
// **네이티브에서도 flex: 1 을 줘야 한다.** 빈 객체를 주면 이 View 가 flex 없이 콘텐츠 높이로
// 잡히고, 그 안의 flex: 1 자식은 나눠 줄 여유 공간이 0이라 높이 0으로 접힌다. 화면이 빈 화면이
// 된다. expo export 도 tsc 도 테스트도 이걸 못 잡는다 — 시뮬레이터를 띄워야 보인다(2026-09-26 QA).
import type { ViewStyle } from 'react-native';
import { isWeb } from '../lib/platform.ts';

export const CONTENT_MAX_WIDTH = 720;

export const contentFrame: ViewStyle = isWeb
  ? { alignSelf: 'center', maxWidth: CONTENT_MAX_WIDTH, width: '100%' }
  : {};

// 폭을 묶으면 좌우에 여백이 생긴다. 그 여백은 프레임 **바깥** 요소가 칠해야 한다.
// 칠하지 않으면 다크 모드에서 양옆만 흰색으로 남는다(2026-09-26 QA).
export function outerFrame(background: string): ViewStyle {
  return isWeb ? { backgroundColor: background, flex: 1 } : { flex: 1 };
}
