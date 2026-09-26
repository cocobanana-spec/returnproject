// 고정 바 위에서 목록이 서서히 사라지게 하는 띠. 글자가 가로로 싹둑 잘려 보이는 것을 막는다
//
// 기록 탭 아래 기록 버튼 바는 불투명한데 목록이 그 아래로 지나간다. 경계선만 그으면 한 줄이
// 글자 한가운데서 잘린 모습이 그대로 남아 "화면이 잘렸다"로 읽힌다(2026-09-26 사용자가 두 번
// 지적. 헤드리스 브라우저로 그대로 재현했다).
//
// expo-linear-gradient 를 넣으면 네이티브를 다시 빌드해야 한다. 배경색 View 를 투명도만
// 달리해 여러 겹 쌓으면 같은 결과를 새 의존성 없이 얻는다. 겹이 8이면 단차가 눈에 띄지 않는다.
import { View } from 'react-native';
import { useTokens } from '../theme/tokens';

const STEPS = 8;

export function ScrollFade({ height = 28 }: { height?: number }) {
  const { colors } = useTokens();
  return (
    <View
      pointerEvents="none"
      style={{ height, left: 0, position: 'absolute', right: 0, top: -height }}
    >
      {Array.from({ length: STEPS }, (_, i) => (
        <View
          key={i}
          style={{ backgroundColor: colors.bg, flex: 1, opacity: (i + 1) / STEPS }}
        />
      ))}
    </View>
  );
}
