// 확인 메일 대기 화면 — 가입 직후와 미확인 계정 로그인 시도 뒤에 온다. 재발송이 여기 있다
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../../src/i18n';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resendConfirmation } from '../../src/auth/email.ts';
import { confirmRedirectUrl } from '../../src/auth/redirects.ts';
import { useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';

export default function CheckEmailScreen() {
  const t = useT();
  const { colors, space, font, radius } = useTokens();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function onResend() {
    if (!email) return;
    setMessage(null);
    setBusy(true);
    let result;
    try {
      result = await resendConfirmation(email, confirmRedirectUrl());
    } finally {
      setBusy(false);
    }
    if (result.ok) {
      setIsError(false);
      setMessage(t('auth.resent'));
    } else {
      setIsError(true);
      setMessage(result.error.message);
    }
  }

  return (
    <Screen edges={{ top: false }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
        <View style={{ alignItems: 'center', gap: space.md }}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: colors.bgSubtle,
              borderRadius: radius.pill,
              height: 72,
              justifyContent: 'center',
              width: 72,
            }}
          >
            <Ionicons name="mail-outline" size={32} color={colors.text} />
          </View>
          <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>
            {t('auth.checkSent')}
          </Text>
          <Text
            style={{ color: colors.textMuted, fontSize: font.body, lineHeight: 22, textAlign: 'center' }}
          >
            {t('auth.checkBody', { email: email ?? t('auth.yourAddress') })}
          </Text>
          <Text
            style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 18, textAlign: 'center' }}
          >
            {t('auth.checkSpam')}
          </Text>
        </View>

        {message && (
          <Text
            style={{
              color: isError ? colors.danger : colors.textMuted,
              fontSize: font.caption,
              textAlign: 'center',
            }}
          >
            {message}
          </Text>
        )}

        <View style={{ gap: space.md }}>
          <Button
            label={t('auth.resend')}
            variant="secondary"
            onPress={() => void onResend()}
            disabled={!email || busy}
            loading={busy}
          />
          <Button label={t('auth.toSignIn')} onPress={() => router.replace('/sign-in')} />
        </View>
      </View>
    </Screen>
  );
}
