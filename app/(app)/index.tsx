// 홈 자리(S01). 5단계에서 요약 카드·최근 기록·FAB가 들어온다. 지금은 토대 확인용 셸이다
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLedger } from '../../src/ledger/LedgerProvider';
import { useTokens } from '../../src/theme/tokens';

export default function HomeScreen() {
  const { current, ledgers } = useLedger();
  const { colors, space, font } = useTokens();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.lg }]}>
      <Text style={{ color: colors.textMuted, fontSize: font.caption }}>현재 장부</Text>
      <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700', marginTop: space.xs }}>
        {current?.name ?? '내 장부'}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: space.sm }}>
        {current?.role === 'owner' ? '내가 만든 장부' : '함께 쓰는 장부'} · 장부 {ledgers.length}권
      </Text>

      <View style={{ marginTop: space.xxl }}>
        <Text style={{ color: colors.textMuted, fontSize: font.body }}>
          홈 화면은 5단계에서 만듭니다.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
});
