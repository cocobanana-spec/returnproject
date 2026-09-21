// 행사 탭(S06) 자리. 목록·상세·명부 입력은 2차 범위라 지금은 안내만 둔다
import { Text } from 'react-native';
import { Screen } from '../../../src/ui/Screen';
import { EmptyState } from '../../../src/ui/EmptyState';
import { useTokens } from '../../../src/theme/tokens';

export default function EventsScreen() {
  const { colors, space, font } = useTokens();
  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700', marginBottom: space.lg }}>
        행사
      </Text>
      <EmptyState
        title="행사 화면은 준비 중입니다"
        hint={'내 행사 등록과 명부 입력은 다음 차수에서 들어옵니다.\n지금은 준돈을 기록하면 행사가 자동으로 만들어집니다.'}
      />
    </Screen>
  );
}
