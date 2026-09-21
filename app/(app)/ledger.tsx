// 장부 화면(S17) — 장부 전환, 이름 편집, 구성원 관리, 초대 코드 생성·입력, 나가기
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthProvider';
import { INVITE_CODE_LENGTH, isValidInviteCode, normalizeInviteCode } from '../../src/domain/invite.ts';
import { useLedger } from '../../src/ledger/LedgerProvider';
import { queryKeys } from '../../src/lib/queryKeys';
import {
  createInviteCode,
  joinLedger,
  listMembers,
  removeMember,
  renameLedger,
} from '../../src/repositories/ledgers';
import { useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Field } from '../../src/ui/Field';
import { Screen } from '../../src/ui/Screen';

export default function LedgerScreen() {
  const { colors, space, font, radius } = useTokens();
  const { userId } = useAuth();
  const { ledgers, current, currentLedgerId, setCurrentLedger, refetch } = useLedger();
  const queryClient = useQueryClient();

  const ledgerId = currentLedgerId as string;
  const isOwner = current?.role === 'owner';

  const [name, setName] = useState(current?.name ?? '');
  const [code, setCode] = useState('');
  const [issued, setIssued] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 장부를 전환하면 이름칸과 발급된 코드가 옛 장부 것으로 남는다.
  // 그대로 두면 B 장부에 A 이름을 덮어쓰거나 A 코드를 B 화면에서 공유하게 된다.
  useEffect(() => {
    setName(current?.name ?? '');
    setIssued(null);
    setMessage(null);
  }, [currentLedgerId, current?.name]);

  const members = useQuery({
    queryKey: queryKeys.ledgers.members(ledgerId),
    queryFn: () => listMembers(ledgerId),
  });

  function invalidateLedgers() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.mine(userId ?? 'anonymous') });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.members(ledgerId) });
    refetch();
  }

  const rename = useMutation({
    mutationFn: (next: string) => renameLedger(ledgerId, next),
    onSuccess: () => {
      setMessage('장부 이름을 바꿨습니다.');
      invalidateLedgers();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const invite = useMutation({
    mutationFn: () => createInviteCode(ledgerId),
    onSuccess: (value) => {
      setIssued(value);
      setMessage(null);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const join = useMutation({
    mutationFn: (raw: string) => joinLedger(normalizeInviteCode(raw)),
    onSuccess: (joinedId) => {
      setCode('');
      setMessage('장부에 합류했습니다.');
      setCurrentLedger(joinedId);
      invalidateLedgers();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const kick = useMutation({
    mutationFn: (targetUserId: string) => removeMember(ledgerId, targetUserId),
    onSuccess: () => {
      setMessage(null);
      invalidateLedgers();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  function confirmRemove(targetUserId: string, label: string) {
    const isSelf = targetUserId === userId;
    Alert.alert(
      isSelf ? '장부에서 나가기' : `${label} 내보내기`,
      isSelf
        ? '이 장부의 기록은 남은 구성원에게 그대로 남습니다.'
        : `${label}님이 이 장부를 더 이상 볼 수 없게 됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        { text: isSelf ? '나가기' : '내보내기', style: 'destructive', onPress: () => kick.mutate(targetUserId) },
      ],
    );
  }

  return (
    <Screen scroll edges={{ top: false }}>
      <View style={{ gap: space.xxl }}>
        {ledgers.length > 1 && (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>장부 고르기</Text>
            {ledgers.map((l) => {
              const selected = l.ledgerId === currentLedgerId;
              return (
                <Button
                  key={l.ledgerId}
                  label={`${l.name}${l.role === 'owner' ? ' (내가 만든 장부)' : ''}`}
                  variant={selected ? 'primary' : 'secondary'}
                  onPress={() => setCurrentLedger(l.ledgerId)}
                />
              );
            })}
          </View>
        )}

        <View style={{ gap: space.sm }}>
          <Field label="장부 이름" value={name} onChangeText={setName} maxLength={30} />
          <Button
            label="이름 저장"
            variant="secondary"
            size="sm"
            disabled={name.trim().length === 0 || name.trim() === current?.name}
            loading={rename.isPending}
            onPress={() => rename.mutate(name.trim())}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
            구성원 {members.data?.length ?? 0}명
          </Text>
          {(members.data ?? []).map((m) => (
            <View
              key={m.user_id}
              style={{
                alignItems: 'center',
                backgroundColor: colors.bgSubtle,
                borderRadius: radius.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
              }}
            >
              <View>
                <Text style={{ color: colors.text, fontSize: font.body }}>
                  {m.display_name}
                  {m.user_id === userId ? ' (나)' : ''}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                  {m.role === 'owner' ? '장부를 만든 사람' : '구성원'}
                </Text>
              </View>
              {(isOwner || m.user_id === userId) && (
                <Button
                  label={m.user_id === userId ? '나가기' : '내보내기'}
                  variant="secondary"
                  size="sm"
                  onPress={() => confirmRemove(m.user_id, m.display_name)}
                />
              )}
            </View>
          ))}
        </View>

        {isOwner && (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>배우자 초대</Text>
            {issued ? (
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: colors.bgSubtle,
                  borderRadius: radius.md,
                  gap: space.sm,
                  paddingVertical: space.lg,
                }}
              >
                <Text
                  style={{ color: colors.text, fontSize: font.heading, fontWeight: '700', letterSpacing: 4 }}
                >
                  {issued}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                  24시간 안에 한 번만 쓸 수 있습니다
                </Text>
                <Button
                  label="코드 공유"
                  size="sm"
                  onPress={() =>
                    void Share.share({
                      message: `뿌린대로거두리라 장부 초대 코드 ${issued}\n앱 더보기 → 장부 → 초대 코드 입력에 넣어 주세요.`,
                    })
                  }
                />
              </View>
            ) : (
              <Button
                label="초대 코드 만들기"
                variant="secondary"
                loading={invite.isPending}
                onPress={() => invite.mutate()}
              />
            )}
          </View>
        )}

        <View style={{ gap: space.sm }}>
          <Field
            label="초대 코드 입력"
            value={code}
            onChangeText={(next) => setCode(normalizeInviteCode(next))}
            placeholder={'A'.repeat(INVITE_CODE_LENGTH)}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={INVITE_CODE_LENGTH}
            style={{ letterSpacing: 4, textAlign: 'center' }}
          />
          <Button
            label="합류하기"
            variant="secondary"
            disabled={!isValidInviteCode(code)}
            loading={join.isPending}
            onPress={() => join.mutate(code)}
          />
        </View>

        {message && (
          <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: font.caption, flex: 1 }}>{message}</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
