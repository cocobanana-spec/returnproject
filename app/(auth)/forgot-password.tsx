// 비밀번호 재설정 요청 화면 — 메일을 보내면 링크가 앱의 ppurin://auth/reset 으로 돌아온다
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { requestPasswordReset } from '../../src/auth/email.ts';
import { resetRedirectUrl } from '../../src/auth/redirects.ts';
import { isLikelyEmail } from '../../src/domain/password.ts';
import { useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Field } from '../../src/ui/Field';
import { Screen } from '../../src/ui/Screen';

export default function ForgotPasswordScreen() {
  const { colors, space, font } = useTokens();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    let result;
    try {
      result = await requestPasswordReset(email, resetRedirectUrl());
    } finally {
      setBusy(false);
    }
    if (result.ok) setSent(true);
    else setError(result.error.message);
  }

  if (sent) {
    return (
      <Screen edges={{ top: false }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
          <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>
            재설정 메일을 보냈습니다
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.body, lineHeight: 22 }}>
            가입된 주소라면 {email}로 메일이 갑니다.{'\n'}
            메일의 링크를 누르면 새 비밀번호를 정할 수 있습니다.
          </Text>
          <Button label="로그인 화면으로" onPress={() => router.replace('/sign-in')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll edges={{ top: false }}>
      <View style={{ gap: space.lg }}>
        <Text style={{ color: colors.textMuted, fontSize: font.body, lineHeight: 22 }}>
          가입할 때 쓴 메일 주소를 넣으면 재설정 링크를 보내 드립니다.
        </Text>

        <Field
          label="메일 주소"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoFocus
        />

        {error && <Text style={{ color: colors.danger, fontSize: font.caption }}>{error}</Text>}

        <Button
          label="재설정 메일 보내기"
          onPress={() => void onSubmit()}
          disabled={!isLikelyEmail(email) || busy}
          loading={busy}
        />
      </View>
    </Screen>
  );
}
