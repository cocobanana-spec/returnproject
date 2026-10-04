// 초대장 미리보기 — 공개 페이지와 같은 HTML 을 웹뷰(앱)·iframe(웹)에 넣어 보여 준다
//
// 템플릿은 HTML 한 벌이다(docs/08 §3.3). 공개 페이지(워커)가 내보내는 것과 같은 함수를 부르므로
// 여기서 본 것이 하객이 보는 것이다. 사진 주소도 같은 규칙(스토리지 공개 URL)이다.
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { createElement } from 'react';
import { Text, View } from 'react-native';
import { shareUrl, type InvitationContent, type InvitationKind } from '../../../src/domain/invitation.ts';
import { renderInvitationPage } from '../../../src/invitation/render/index.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { isWeb } from '../../../src/lib/platform.ts';
import { queryKeys } from '../../../src/lib/queryKeys';
import { getInvitation, photoUrl } from '../../../src/repositories/invitations.ts';
import { useTokens } from '../../../src/theme/tokens';
import { LoadFailed } from '../../../src/ui/LoadFailed';
import { Screen } from '../../../src/ui/Screen';

export default function InvitationPreviewScreen() {
  const ledgerId = useLedgerId();
  const { colors, font } = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();

  const inv = useQuery({
    queryKey: queryKeys.invitations.detail(ledgerId, id),
    queryFn: () => getInvitation(ledgerId, id),
  });

  if (inv.isError) {
    return (
      <Screen>
        <LoadFailed title="초대장을 불러오지 못했습니다" onRetry={() => void inv.refetch()} />
      </Screen>
    );
  }
  if (!inv.data) {
    return (
      <Screen>
        <Text style={{ color: colors.textMuted, fontSize: font.body }}>{inv.isLoading ? '불러오는 중…' : '초대장이 없습니다.'}</Text>
      </Screen>
    );
  }

  const html = renderInvitationPage({
    kind: inv.data.kind as InvitationKind,
    templateId: inv.data.template_id,
    content: inv.data.content as unknown as InvitationContent,
    url: shareUrl(inv.data.slug),
    assetUrl: photoUrl,
  });

  if (isWeb) {
    // react-native-web 에는 iframe 이 없다. DOM 요소를 직접 만든다. srcDoc 이라 네트워크를 타지 않는다.
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {createElement('iframe', {
          srcDoc: html,
          title: '초대장 미리보기',
          style: { border: 0, width: '100%', height: '100%', minHeight: 600 },
          sandbox: 'allow-same-origin allow-popups',
        })}
      </View>
    );
  }

  // Expo Router 는 모든 라우트 모듈을 시작 때 평가한다. 웹 번들에서 react-native-webview 를 위에서
  // import 하면 네이티브 전용 모듈이 평가되다 죽어 웹 앱 전체가 안 뜬다. 네이티브에서만 필요할 때 부른다.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WebView } = require('react-native-webview') as typeof import('react-native-webview');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <WebView originWhitelist={['*']} source={{ html, baseUrl: 'https://ppurin.com/' }} style={{ flex: 1 }} />
    </View>
  );
}
