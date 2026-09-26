// 더보기(S13) — 기록 관리·장부·계정을 묶음으로 나눠 놓은 입구
//
// 하단 탭이 홈·통계·더보기 셋으로 줄면서 사람(S03)과 행사(S06)가 이 안으로 들어왔다.
// 잡동사니가 되지 않게 "기록 관리 / 장부 / 계정" 세 묶음으로 나눈다.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildCsv, exportFileName } from '../../../src/domain/exportCsv.ts';
import { todayISO } from '../../../src/domain/title.ts';
import { useLedger } from '../../../src/ledger/LedgerProvider';
import { canDownload, downloadText } from '../../../src/lib/downloadFile.ts';
import { listAllEntries } from '../../../src/repositories/entries';
import { useTokens } from '../../../src/theme/tokens';
import { Screen } from '../../../src/ui/Screen';
import { useToast } from '../../../src/ui/ToastProvider';

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
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  // 내보내기는 브라우저 내려받기를 쓰므로 웹에만 있다(docs/04 "아직 아닌 것").
  async function onExport() {
    if (exporting || !current) return;
    setExporting(true);
    try {
      const rows = await listAllEntries(current.ledgerId);
      if (rows.length === 0) {
        toast.show({ message: '내보낼 기록이 없습니다.' });
        return;
      }
      downloadText(exportFileName(current.name, todayISO()), buildCsv(rows));
      toast.show({ message: `기록 ${rows.length}건을 내려받았습니다.` });
    } catch (error) {
      toast.show({ message: `내보내지 못했습니다 · ${(error as Error).message}`, durationMs: 4000 });
    } finally {
      setExporting(false);
    }
  }

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
        <Row
          icon="cloud-upload-outline"
          label="가져오기"
          hint="엑셀·CSV 파일로 준돈 기록이나 내 행사 명부를 한 번에"
          onPress={() => router.push('/import')}
        />
        {canDownload() ? (
          <Row
            icon="download-outline"
            label={exporting ? '내보내는 중…' : '내보내기'}
            hint="장부의 모든 기록을 CSV 파일로 내려받습니다. 엑셀에서 바로 열립니다"
            onPress={() => void onExport()}
          />
        ) : null}
      </Section>

      <Section title="장부">
        <Row
          icon="book-outline"
          label="장부"
          hint={`${current?.name ?? '내 장부'}${ledgers.length > 1 ? ` 외 ${ledgers.length - 1}권` : ''}`}
          onPress={() => router.push('/ledger')}
        />
        <Row
          icon="trash-outline"
          label="장부 초기화"
          hint="사람·행사·기록을 전부 지웁니다. 되돌릴 수 없습니다"
          onPress={() => router.push('/ledger-reset')}
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

      {/* 안내는 실제로 없는 것만 적는다. 내보내기는 웹에 들어왔으므로 앱에서만 남는 말이다. */}
      <Text
        style={{ color: colors.textMuted, fontSize: font.caption, marginTop: space.xl, lineHeight: 20 }}
      >
        {canDownload()
          ? '기록 검색은 다음 단계에서 들어옵니다.'
          : '기록 검색은 다음 단계에서 들어옵니다.\n내보내기는 지금은 웹에서만 됩니다.'}
      </Text>
    </Screen>
  );
}
