// 초대 코드로 남의 행사에 참여한다(S23) — 그 행사의 받은 돈 명부를 같이 적게 된다 (0016)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { normalizeInviteCode } from '../../../src/domain/invite.ts';
import { useT } from '../../../src/i18n';
import { joinEvent } from '../../../src/repositories/events';
import { useTokens } from '../../../src/theme/tokens';
import { Button } from '../../../src/ui/Button';
import { Field } from '../../../src/ui/Field';
import { Screen } from '../../../src/ui/Screen';
import { useToast } from '../../../src/ui/ToastProvider';

export default function JoinEventScreen() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { colors, space, font } = useTokens();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: () => joinEvent(normalizeInviteCode(code)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events', 'shared'] });
      toast.show({ message: t('share.joined') });
      router.back();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Screen>
      <View style={{ gap: space.lg, paddingTop: space.lg }}>
        <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>{t('share.joinTitle')}</Text>
        <Text style={{ color: colors.textMuted, fontSize: font.body, lineHeight: 22 }}>{t('share.joinHint')}</Text>
        <Field
          label={t('share.code')}
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setError(null);
          }}
          placeholder="ABCD1234"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
        />
        {error && <Text style={{ color: colors.danger, fontSize: font.caption }}>{error}</Text>}
        <Button label={t('share.join')} onPress={() => join.mutate()} disabled={normalizeInviteCode(code).length < 8} loading={join.isPending} />
      </View>
    </Screen>
  );
}
