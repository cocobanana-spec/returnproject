// 더보기(S13) — 섹션마다 카드 하나, 카드 안에 ListRow(docs/DESIGN.md 3단계). 기록 관리 / 다른 기기 / 언어 / 계정
//
// 하단 탭이 홈·통계·더보기 셋으로 줄면서 사람(S03)과 행사(S06)가 이 안으로 들어왔다.
// 언어는 ListRow 를 누르면 시트에서 고른다(칩·세그먼트 대신).
import { useQuery } from '@tanstack/react-query';
import { setLocaleSetting, useLocaleSetting, useT } from '../../../src/i18n';
import { LOCALES, LOCALE_LABEL } from '../../../src/i18n/dict.ts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, Pressable, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildCsv, exportFileName } from '../../../src/domain/exportCsv.ts';
import { todayISO } from '../../../src/domain/title.ts';
import { useLedger } from '../../../src/ledger/LedgerProvider';
import { canDownload, downloadText } from '../../../src/lib/downloadFile.ts';
import { isWeb } from '../../../src/lib/platform.ts';
import { APP_STORE_URL, WEB_APP_URL, shortUrl } from '../../../src/lib/urls.ts';
import { listAllEntries } from '../../../src/repositories/entries';
import { db } from '../../../src/lib/supabaseClient.ts';
import { useTokens } from '../../../src/theme/tokens';
import { Card } from '../../../src/ui/Card';
import { ListRow } from '../../../src/ui/ListRow';
import { Screen } from '../../../src/ui/Screen';
import { SectionHeader } from '../../../src/ui/SectionHeader';
import { useToast } from '../../../src/ui/ToastProvider';

export default function MoreScreen() {
  const t = useT();
  const localeSetting = useLocaleSetting();
  const router = useRouter();
  const { current } = useLedger();
  const { colors, space, font, radius } = useTokens();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
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

  const languageOptions: { key: string; label: string }[] = [
    { key: 'system', label: t('more.languageSystem') },
    ...LOCALES.map((l) => ({ key: l, label: LOCALE_LABEL[l] })),
  ];
  const languageLabel = languageOptions.find((o) => o.key === localeSetting)?.label ?? '';

  return (
    <Screen scroll style={{ gap: space.xxl, paddingBottom: insets.bottom + 120 }}>
      <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>{t('more.title')}</Text>

      <View>
        <SectionHeader title={t('more.records')} />
        <Card padded={false}>
          {/* '사람' 줄은 뺐다(2026-10-04 사장님 결정). 사람 원장은 홈 목록·검색·통계에서 가고, 합치기는 사람 원장 ⋯ 안에 있다 */}
          <ListRow icon="calendar" title={t('more.events')} caption={t('more.eventsHint')} chevron onPress={() => router.push('/events')} />
          <ListRow icon="cloud-upload" title={t('more.import')} caption={t('more.importHint')} chevron onPress={() => router.push('/import')} />
          {canDownload() ? (
            <ListRow icon="download" title={exporting ? t('more.exporting') : t('more.export')} caption={t('more.exportHint')} chevron onPress={() => void onExport()} />
          ) : null}
        </Card>
      </View>

      {/* 앱에서는 웹이 있는 줄 모르고, 웹에서는 앱이 있는 줄 모른다(2026-10-03 사용자 지적).
          서로를 가리키는 줄을 하나씩 둔다. 앱 쪽은 공유 시트로 띄운다 — 폰 브라우저에서 여는 것보다
          AirDrop·메시지로 PC 에 보내는 쪽이 "PC 에서 쓰려는" 목적에 맞다. */}
      <View>
        <SectionHeader title={t('more.otherDevices')} />
        <Card padded={false}>
          {isWeb ? (
            <ListRow icon="phone-portrait" title={t('more.iosApp')} caption={t('more.iosAppHint')} chevron onPress={() => void Linking.openURL(APP_STORE_URL)} />
          ) : (
            <ListRow
              icon="desktop"
              title={t('more.webApp')}
              caption={t('more.webAppHint', { url: shortUrl(WEB_APP_URL) })}
              chevron
              onPress={() =>
                void Share.share({
                  title: t('more.webShareTitle'),
                  message: t('more.webShareMessage', { url: WEB_APP_URL }),
                  url: WEB_APP_URL,
                }).catch(() => {})
              }
            />
          )}
        </Card>
      </View>

      {/* 언어 — 기기 설정을 따르거나 셋 중 하나로 고정한다(2026-10-04 사용자 요청: 한·영·일). 누르면 시트 */}
      <View>
        <SectionHeader title={t('more.language')} />
        <Card padded={false}>
          <ListRow icon="globe" title={t('more.language')} value={languageLabel} valueTone="muted" chevron onPress={() => setLangOpen(true)} />
        </Card>
      </View>

      {isAdmin.data && (
        <View>
          <SectionHeader title={t('more.ops')} />
          <Card padded={false}>
            <ListRow icon="stats-chart" title={t('more.admin')} caption={t('more.adminHint')} chevron onPress={() => router.push('/admin')} />
          </Card>
        </View>
      )}

      <View>
        <SectionHeader title={t('more.accountSection')} />
        <Card padded={false}>
          <ListRow icon="trash" iconTone="danger" title={t('more.reset')} caption={t('more.resetHint')} chevron onPress={() => router.push('/ledger-reset')} />
          <ListRow icon="person-circle" iconTone="muted" title={t('more.account')} caption={t('more.accountHint')} chevron onPress={() => router.push('/account')} />
        </Card>
      </View>

      {/* 안내는 실제로 없는 것만 적는다. 내보내기는 웹에 들어왔으므로 앱에서만 남는 말이다. */}
      <Text style={{ color: colors.textFaint, fontSize: font.caption, lineHeight: 20 }}>
        {canDownload() ? t('more.footnote') : t('more.footnoteNative')}
      </Text>

      {/* 언어 시트 — 아래에서 올라오는 카드. 고르면 바로 닫힌다 */}
      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(25,31,40,0.35)' }} onPress={() => setLangOpen(false)} />
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: insets.bottom + space.lg, paddingTop: space.sm }}>
          <View style={{ alignSelf: 'center', backgroundColor: colors.border, borderRadius: 2, height: 4, marginBottom: space.md, width: 36 }} />
          <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700', paddingHorizontal: space.xl, paddingVertical: space.sm }}>{t('more.language')}</Text>
          {languageOptions.map((o) => (
            <ListRow
              key={o.key}
              title={o.label}
              right={o.key === localeSetting ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : undefined}
              onPress={() => {
                void setLocaleSetting(o.key as typeof localeSetting);
                setLangOpen(false);
              }}
            />
          ))}
        </View>
      </Modal>
    </Screen>
  );
}
