// 더보기(S13) — 기록 관리·장부·계정을 묶음으로 나눠 놓은 입구
//
// 하단 탭이 홈·통계·더보기 셋으로 줄면서 사람(S03)과 행사(S06)가 이 안으로 들어왔다.
// 잡동사니가 되지 않게 "기록 관리 / 장부 / 계정" 세 묶음으로 나눈다.
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLedger } from '../../../src/ledger/LedgerProvider';
import { useTokens } from '../../../src/theme/tokens';
import { Screen } from '../../../src/ui/Screen';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, space, font } = useTokens();
  return (
    <View style={{ marginTop: space.xl }}>
      <Text style={{ color: colors.textMuted, fontSize: font.caption, marginBottom: space.xs }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  const { colors, space, font } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: space.md,
        paddingVertical: space.lg,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: font.body }}>{label}</Text>
        {hint && (
          <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>{hint}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { current, ledgers } = useLedger();
  const { colors, space, font } = useTokens();

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>더보기</Text>

      <Section title="기록 관리">
        <Row
          icon="people-outline"
          label="사람"
          hint="이름·관계 정리, 동명이인 합치기"
          onPress={() => router.push('/people')}
        />
        <Row
          icon="calendar-outline"
          label="행사"
          hint="내 행사 만들기, 명부 입력, 행사별 정산"
          onPress={() => router.push('/events')}
        />
      </Section>

      <Section title="장부">
        <Row
          icon="book-outline"
          label="장부"
          hint={`${current?.name ?? '내 장부'}${ledgers.length > 1 ? ` 외 ${ledgers.length - 1}권` : ''}`}
          onPress={() => router.push('/ledger')}
        />
      </Section>

      <Section title="계정">
        <Row
          icon="person-circle-outline"
          label="계정"
          hint="로그아웃, 계정 삭제"
          onPress={() => router.push('/account')}
        />
      </Section>

      <Text
        style={{ color: colors.textMuted, fontSize: font.caption, marginTop: space.xl, lineHeight: 20 }}
      >
        기록 검색과 데이터 내보내기는 다음 단계(P1)에서 들어옵니다.
      </Text>
    </Screen>
  );
}
