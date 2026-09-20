// 오프라인일 때 화면 맨 위에 붙는 띠. 읽기는 캐시로 계속 보이지만 쓰기는 막힌다는 것을 알린다
import { Text, View } from 'react-native';
import { useOnline } from '../lib/useOnline';
import { useTokens } from '../theme/tokens';

export function OfflineBanner() {
  const online = useOnline();
  const { colors, space, font } = useTokens();

  if (online) return null;

  return (
    <View style={{ backgroundColor: colors.danger, paddingVertical: space.sm, paddingHorizontal: space.lg }}>
      <Text style={{ color: '#FFFFFF', fontSize: font.caption, textAlign: 'center' }}>
        오프라인 · 저장한 내용만 보입니다
      </Text>
    </View>
  );
}
