// 더보기(S13) — 기록 관리·장부·계정을 묶음으로 나눠 놓은 입구
//
// 하단 탭이 홈·통계·더보기 셋으로 줄면서 사람(S03)과 행사(S06)가 이 안으로 들어왔다.
// 잡동사니가 되지 않게 "기록 관리 / 장부 / 계정" 세 묶음으로 나눈다.
import { useQuery } from '@tanstack/react-query';
import { setLocaleSetting, useLocaleSetting, useT } from '../../../src/i18n';
import { LOCALES, LOCALE_LABEL } from '../../../src/i18n/dict.ts';
import { Chip } from '../../../src/ui/Chip';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildCsv, exportFileName } from '../../../src/domain/exportCsv.ts';
import { todayISO } from '../../../src/domain/title.ts';
import { useLedger } from '../../../src/ledger/LedgerProvider';
import { canDownload, downloadText } from '../../../src/lib/downloadFile.ts';
import { isWeb } from '../../../src/lib/platform.ts';
import { APP_STORE_URL, WEB_APP_URL, shortUrl } from '../../../src/lib/urls.ts';
import { listAllEntries } from '../../../src/repositories/entries';
import { db } from '../../../src/lib/supabaseClient.ts';
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
  const t = useT();
  const localeSetting = useLocaleSetting();
  const router = useRouter();
  const { current, ledgers } = useLedger();
  const { colors, space, font } = useTokens();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  // 관리자인지는 서버가 안다. 여기서는 줄을 보여 줄지만 정한다 — 통계 함수가 다시 거부한다.
  const isAdmin = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: async () => (await db().rpc('is_app_admin')).data === true,
    staleTime: 10 * 60_000,
  });

  // 내보내기는 브라우저 내려받기를 쓰므로 웹에만 있다(docs/04 "아직 아닌 것").
  async function onExport() {
    if (exporting || !current) return;
    setExporting(true);
    try {
      const rows = await listAllEntries(current.ledgerId);
      if (rows.length === 0) {
        toast.show({ message: t('more.exportEmpty') });
        return;
      }
      downloadText(exportFileName(current.name, todayISO()), buildCsv(rows));
      toast.show({ message: t('more.exportDone', { n: rows.length }) });
    } catch (error) {
      toast.show({ message: t('more.exportFailed', { error: (error as Error).message }), durationMs: 4000 });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>{t('more.title')}</Text>

      <Section title={t('more.records')}>
        <Row
          icon="people-outline"
          label={t('more.people')}
          hint={t('more.peopleHint')}
          onPress={() => router.push('/people')}
        />
        <Row
          icon="calendar-outline"
          label={t('more.events')}
          hint={t('more.eventsHint')}
          onPress={() => router.push('/events')}
        />
        <Row
          icon="cloud-upload-outline"
          label={t('more.import')}
          hint={t('more.importHint')}
          onPress={() => router.push('/import')}
        />
        {canDownload() ? (
          <Row
            icon="download-outline"
            label={exporting ? t('more.exporting') : t('more.export')}
            hint={t('more.exportHint')}
            onPress={() => void onExport()}
          />
        ) : null}
      </Section>

      {/* 앱에서는 웹이 있는 줄 모르고, 웹에서는 앱이 있는 줄 모른다(2026-10-03 사용자 지적).
          서로를 가리키는 줄을 하나씩 둔다. 앱 쪽은 공유 시트로 띄운다 — 폰 브라우저에서 여는 것보다
          AirDrop·메시지로 PC 에 보내는 쪽이 "PC 에서 쓰려는" 목적에 맞다. */}
      <Section title={t('more.otherDevices')}>
        {isWeb ? (
          <Row
            icon="phone-portrait-outline"
            label={t('more.iosApp')}
            hint={t('more.iosAppHint')}
            onPress={() => void Linking.openURL(APP_STORE_URL)}
          />
        ) : (
          <Row
            icon="desktop-outline"
            label={t('more.webApp')}
            hint={t('more.webAppHint', { url: shortUrl(WEB_APP_URL) })}
            onPress={() =>
              void Share.share({
                title: t('more.webShareTitle'),
                message: t('more.webShareMessage', { url: WEB_APP_URL }),
                url: WEB_APP_URL,
              }).catch(() => {})
            }
          />
        )}
      </Section>

      {/* 언어 — 기기 설정을 따르거나 셋 중 하나로 고정한다(2026-10-04 사용자 요청: 한·영·일) */}
      <Section title={t('more.language')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip label={t('more.languageSystem')} selected={localeSetting === 'system'} onPress={() => void setLocaleSetting('system')} />
          {LOCALES.map((l) => (
            <Chip key={l} label={LOCALE_LABEL[l]} selected={localeSetting === l} onPress={() => void setLocaleSetting(l)} />
          ))}
        </View>
      </Section>

      {isAdmin.data && (
        <Section title={t('more.ops')}>
          <Row icon="stats-chart-outline" label={t('more.admin')} hint={t('more.adminHint')} onPress={() => router.push('/admin')} />
        </Section>
      )}

      <Section title={t('more.accountSection')}>
        <Row
          icon="trash-outline"
          label={t('more.reset')}
          hint={t('more.resetHint')}
          onPress={() => router.push('/ledger-reset')}
        />
        <Row
          icon="person-circle-outline"
          label={t('more.account')}
          hint={t('more.accountHint')}
          onPress={() => router.push('/account')}
        />
      </Section>

      {/* 안내는 실제로 없는 것만 적는다. 내보내기는 웹에 들어왔으므로 앱에서만 남는 말이다. */}
      <Text
        style={{ color: colors.textMuted, fontSize: font.caption, marginTop: space.xl, lineHeight: 20 }}
      >
        {canDownload() ? t('more.footnote') : t('more.footnoteNative')}
      </Text>
    </Screen>
  );
}
