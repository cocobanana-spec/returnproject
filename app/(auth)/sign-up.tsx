// 회원가입 화면 — 메일·비밀번호·비밀번호 확인. 가입하면 확인 메일이 나간다
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  PASSWORD_RULE_TEXT,
  isLikelyEmail,
  validatePassword,
  validatePasswordConfirm,
} from '../../src/domain/password.ts';
import { signUpWithEmail } from '../../src/auth/email.ts';
import { confirmRedirectUrl } from '../../src/auth/redirects.ts';
import { useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Field } from '../../src/ui/Field';
import { Screen } from '../../src/ui/Screen';

export default function SignUpScreen() {
  const { colors, space, font } = useTokens();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // 비밀번호 규칙은 타이핑 중에 바로 보여 준다. 저장을 누른 뒤에 알려 주면 늦다.
  const liveRule = password.length > 0 ? validatePassword(password) : null;
  const canSubmit =
    isLikelyEmail(email) && validatePasswordConfirm(password, confirm).ok && !busy;

  async function onSubmit() {
    setErrors([]);
    const check = validatePasswordConfirm(password, confirm);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setBusy(true);
    let result;
    try {
      result = await signUpWithEmail(email, password, confirmRedirectUrl());
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setErrors([result.error.message]);
      return;
    }
    // 메일 확인이 켜져 있으면 세션 없이 확인 메일만 나간다. 대기 화면으로 보낸다.
    if (result.needsConfirmation) {
      router.replace({ pathname: '/check-email', params: { email } });
    }
    // 확인이 꺼진 프로젝트라면 세션이 바로 생기고 게이트가 홈으로 보낸다.
  }

  return (
    <Screen scroll edges={{ top: false }}>
      <View style={{ gap: space.lg }}>
        <Text style={{ color: colors.textMuted, fontSize: font.body, lineHeight: 22 }}>
          메일 주소로 가입하면 기기를 바꿔도 장부가 그대로 남습니다.
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

        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          hint={PASSWORD_RULE_TEXT}
        />

        {liveRule && !liveRule.ok && (
          <View style={{ gap: space.xs }}>
            {liveRule.errors.map((e) => (
              <Text key={e} style={{ color: colors.danger, fontSize: font.caption }}>
                {e}
              </Text>
            ))}
          </View>
        )}

        <Field
          label="비밀번호 확인"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
        />

        {confirm.length > 0 && password !== confirm && (
          <Text style={{ color: colors.danger, fontSize: font.caption }}>
            비밀번호가 서로 다릅니다.
          </Text>
        )}

        {errors.map((e) => (
          <Text key={e} style={{ color: colors.danger, fontSize: font.caption }}>
            {e}
          </Text>
        ))}

        <Button label="가입하기" onPress={() => void onSubmit()} disabled={!canSubmit} loading={busy} />
      </View>
    </Screen>
  );
}
