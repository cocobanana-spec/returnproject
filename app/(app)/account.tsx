// 계정(S16) — 로그아웃과 계정 삭제. 삭제가 장부마다 무엇을 하는지 실제 목록으로 보여 준다
import { useQueries, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { confirmAction } from '../../src/lib/confirm.ts';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { deleteAccount } from '../../src/auth/account.ts';
import { signOut } from '../../src/auth/providers';
import {
  accountDeletionPlan,
  deletionDialogBody,
  outcomeLine,
} from '../../src/domain/account.ts';
import { useLedger } from '../../src/ledger/LedgerProvider';
import { queryKeys } from '../../src/lib/queryKeys';
import { listMembers } from '../../src/repositories/ledgers';
import { useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';

export default function AccountScreen() {
  const { session } = useAuth();
  const { ledgers } = useLedger();
  const router = useRouter();
  const { colors, space, font, radius } = useTokens();
  const [busy, setBusy] = useState<'signout' | 'delete' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 장부마다 구성원 수를 받아 "혼자 쓰던 장부인지"를 실제로 판정한다.
  const memberQueries = useQueries({
    queries: ledgers.map((l) => ({
      queryKey: queryKeys.ledgers.members(l.ledgerId),
      queryFn: () => listMembers(l.ledgerId),
    })),
  });

  const loading = memberQueries.some((q) => q.isLoading);
  const failed = memberQueries.some((q) => q.isError);

  const plan = accountDeletionPlan(
    ledgers.map((l, i) => ({
      ledgerId: l.ledgerId,
      name: l.name,
      memberCount: memberQueries[i]?.data?.length ?? 1,
    })),
  );

  async function onSignOut() {
    const ok = await confirmAction({
      title: '로그아웃',
      message: '이 기기에서 로그아웃합니다. 기록은 서버에 그대로 남습니다.',
      confirmLabel: '로그아웃',
      // 되돌릴 수 없는 일은 아니지만 예전부터 빨간 버튼이었다. 눈에 띄어야 오작동이 줄어든다.
      destructive: true,
    });
    if (!ok) return;
    setBusy('signout');
    void signOut().finally(() => setBusy(null));
  }

  async function confirm(body: string) {
    const ok = await confirmAction({
      title: '계정 삭제',
      message: body,
      confirmLabel: '삭제',
      destructive: true,
    });
    if (!ok) return;
    setMessage(null);
    setBusy('delete');
    void deleteAccount()
      .then((result) => {
        if (result.ok) {
          // 서버에서 계정이 사라졌다. 로컬 세션과 캐시도 비우고 로그인 화면으로 간다.
          return signOut();
        }
        setMessage(result.message);
        return undefined;
      })
      // 계정은 사라졌는데 로그아웃이 실패하면 화면이 아무 말도 안 하게 된다.
      .catch(() => setMessage('로그아웃하지 못했습니다. 앱을 다시 실행해 주세요.'))
      .finally(() => setBusy(null));
  }

  async function onDelete() {
    // 되돌릴 수 없는 조작이라 일반론이 아니라 내 장부 목록에 근거한 결과를 보여 준다.
    // 캐시가 묵으면 "나만 빠진다"고 안내한 장부가 실제로는 통째로 삭제될 수 있다.
    // 서버 판정은 삭제 순간의 구성원 수이므로, 문구도 방금 받은 값으로 만든다.
    setMessage(null);
    setBusy('delete');
    try {
      const fresh = await Promise.all(
        ledgers.map(async (l) => ({
          ledgerId: l.ledgerId,
          name: l.name,
          memberCount: (await listMembers(l.ledgerId)).length,
        })),
      );
      confirm(deletionDialogBody(accountDeletionPlan(fresh)));
    } catch {
      setMessage('장부 정보를 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen scroll edges={{ top: false }}>
      <View style={{ gap: space.xl }}>
        <View style={{ gap: space.xs }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>로그인 계정</Text>
          <Text style={{ color: colors.text, fontSize: font.body }}>
            {session?.user.email ?? '메일 주소 없음'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
            {providerLabel(session?.user.app_metadata?.provider)}
          </Text>
        </View>

        <Button label="로그아웃" variant="secondary" onPress={onSignOut} loading={busy === 'signout'} />

        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.danger, fontSize: font.caption, fontWeight: '700' }}>
            계정 삭제
          </Text>
          <View
            style={{
              backgroundColor: colors.bgSubtle,
              borderRadius: radius.md,
              gap: space.xs,
              padding: space.lg,
            }}
          >
            {loading ? (
              <ActivityIndicator color={colors.textMuted} />
            ) : failed ? (
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                장부 정보를 불러오지 못했습니다. 연결을 확인한 뒤 다시 열어 주세요.
              </Text>
            ) : plan.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                속한 장부가 없습니다. 계정만 삭제됩니다.
              </Text>
            ) : (
              plan.map((o) => (
                <Text key={o.ledgerId} style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
                  {outcomeLine(o)}
                </Text>
              ))
            )}
          </View>
          {message && <Text style={{ color: colors.danger, fontSize: font.caption }}>{message}</Text>}
          <Button
            label="계정 삭제"
            variant="danger"
            onPress={() => void onDelete()}
            loading={busy === 'delete'}
            disabled={busy !== null || loading || failed}
          />
          <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 18 }}>
            삭제하면 되돌릴 수 없습니다. 같은 메일로 다시 가입하면 빈 장부로 시작합니다.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function providerLabel(provider: unknown): string {
  if (provider === 'apple') return 'Apple로 로그인';
  if (provider === 'google') return 'Google로 로그인';
  if (provider === 'email') return '메일·비밀번호로 로그인';
  return '';
}
