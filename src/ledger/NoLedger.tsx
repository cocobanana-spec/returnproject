// 장부가 0권일 때의 화면. 구성원에서 제거되면 생기는 상태이며 할 수 있는 일은 초대 코드 입력뿐이다
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { isValidInviteCode, normalizeInviteCode, INVITE_CODE_LENGTH } from '../domain/invite.ts';
import { queryKeys } from '../lib/queryKeys';
import { joinLedger } from '../repositories/ledgers';
import { useTokens } from '../theme/tokens';

export function NoLedger() {
  const { colors, space, font, radius } = useTokens();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: (raw: string) => joinLedger(normalizeInviteCode(raw)),
    onSuccess: () => {
      setMessage(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.mine(userId ?? 'anonymous') });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const valid = isValidInviteCode(code);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top + space.xxl,
        paddingHorizontal: space.xl,
        gap: space.lg,
      }}
    >
      <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>장부가 없습니다</Text>
      <Text style={{ color: colors.textMuted, fontSize: font.body, lineHeight: 22 }}>
        배우자에게 받은 초대 코드를 입력하면 함께 쓰는 장부에 들어갑니다.
      </Text>

      <TextInput
        value={code}
        onChangeText={(next) => setCode(normalizeInviteCode(next))}
        placeholder={'A'.repeat(INVITE_CODE_LENGTH)}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={INVITE_CODE_LENGTH}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          color: colors.text,
          fontSize: font.title,
          letterSpacing: 4,
          paddingHorizontal: space.lg,
          paddingVertical: space.lg,
          textAlign: 'center',
        }}
      />

      {message && <Text style={{ color: colors.danger, fontSize: font.caption }}>{message}</Text>}

      <Pressable
        disabled={!valid || join.isPending}
        onPress={() => join.mutate(code)}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: colors.accent,
          borderRadius: radius.md,
          opacity: !valid || join.isPending || pressed ? 0.6 : 1,
          paddingVertical: space.lg,
        })}
      >
        {join.isPending ? (
          <ActivityIndicator color={colors.textOnAccent} />
        ) : (
          <Text style={{ color: colors.textOnAccent, fontSize: font.body, fontWeight: '600' }}>합류하기</Text>
        )}
      </Pressable>
    </View>
  );
}
