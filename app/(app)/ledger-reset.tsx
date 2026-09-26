// 장부 초기화(S13 하위) — 현재 장부의 사람·행사·기록을 전부 지운다. 장부와 구성원은 남는다
//
// 2026-09-26 사용자 요청. **되돌릴 수 없다.** 그래서 확인을 두 겹으로 둔다.
// ① 지워질 실제 건수를 숫자로 보여 준다. ② 장부 이름을 그대로 입력해야 버튼이 켜진다.
// 판정은 도메인(resetLedger.ts)이 하고 이 화면은 그리기만 한다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { confirmAction, notify } from '../../src/lib/confirm.ts';
import { ActivityIndicator, Text, View } from 'react-native';
import {
  canResetLedger,
  resetDoneLine,
  resetWarningLine,
  type LedgerContents,
} from '../../src/domain/resetLedger.ts';
import { useLedger, useLedgerId } from '../../src/ledger/LedgerProvider';
import { queryKeys } from '../../src/lib/queryKeys';
import { countLedgerContents, resetLedger } from '../../src/repositories/ledgers';
import { useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Field } from '../../src/ui/Field';
import { LoadFailed } from '../../src/ui/LoadFailed';
import { Screen } from '../../src/ui/Screen';

export default function LedgerResetScreen() {
  const ledgerId = useLedgerId();
  const { current } = useLedger();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, space, font, radius } = useTokens();

  const [typed, setTyped] = useState('');

  const counts = useQuery({
    queryKey: queryKeys.ledgers.contents(ledgerId),
    queryFn: () => countLedgerContents(ledgerId),
  });

  const reset = useMutation({
    mutationFn: () => resetLedger(ledgerId),
    onSuccess: (done: LedgerContents) => {
      queryClient.clear();
      // 창을 어떻게 닫든 빈 장부의 초기화 화면에 머물지 않게 한다.
      void notify('장부를 초기화했습니다', resetDoneLine(done)).then(() => router.replace('/'));
    },
    onError: (e: Error) => void notify('초기화하지 못했습니다', e.message),
  });

  if (counts.isError) {
    return (
      <Screen>
        <LoadFailed title="지워질 건수를 세지 못했습니다" onRetry={() => void counts.refetch()} />
      </Screen>
    );
  }

  const name = current?.name ?? '';
  // 초기화는 장부를 만든 사람만 한다(0008). 서버가 not_owner로 막지만, 눌러 보고 나서
  // 아는 것보다 처음부터 이유를 보여 주는 편이 낫다.
  const isOwner = current?.role === 'owner';
  const ready = isOwner && canResetLedger(name, typed) && !reset.isPending;

  return (
    <Screen scroll>
      <View style={{ gap: space.lg, paddingTop: space.lg }}>
        <View
          style={{
            backgroundColor: colors.bgSubtle,
            borderRadius: radius.lg,
            gap: space.xs,
            padding: space.lg,
          }}
        >
          <Text style={{ color: colors.danger, fontSize: font.body, fontWeight: '700' }}>
            되돌릴 수 없습니다
          </Text>
          {counts.isLoading ? (
            <ActivityIndicator color={colors.textMuted} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Text style={{ color: colors.text, fontSize: font.body, lineHeight: 22 }}>
              {resetWarningLine(counts.data ?? { people: 0, events: 0, entries: 0 })}
            </Text>
          )}
          <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
            장부와 함께 쓰는 사람은 그대로 남습니다. 지워진 기록은 되살릴 수 없으니, 남겨 둘 것이
            있으면 먼저 내보내기를 하세요.
          </Text>
        </View>

        {!isOwner && (
          <Text style={{ color: colors.danger, fontSize: font.body, lineHeight: 22 }}>
            장부를 만든 사람만 초기화할 수 있습니다.
          </Text>
        )}
        <Field
          label={`확인을 위해 장부 이름 "${name}"을 그대로 입력하세요`}
          editable={isOwner}
          value={typed}
          onChangeText={setTyped}
          autoCorrect={false}
          placeholder={name}
        />

        <Button
          label={reset.isPending ? '지우는 중' : '전부 지우기'}
          variant="danger"
          disabled={!ready}
          loading={reset.isPending}
          onPress={() => {
            void confirmAction({
              title: '정말 지울까요',
              message: resetWarningLine(counts.data ?? { people: 0, events: 0, entries: 0 }),
              confirmLabel: '전부 지우기',
              destructive: true,
            }).then((ok) => {
              if (ok) reset.mutate();
            });
          }}
        />
        <Button label="취소" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
