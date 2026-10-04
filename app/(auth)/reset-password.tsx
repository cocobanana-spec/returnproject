// 새 비밀번호 입력 화면 — 재설정 링크로 들어왔을 때만 열린다
//
// 링크 교환으로 세션이 이미 생겨 있지만, 비밀번호를 바꾸기 전까지는 게이트가 홈으로 보내지 않는다
// (AuthProvider의 resetPending). 여기서 바꾸면 resetPending을 내리고 홈으로 간다.
import { useRouter } from 'expo-router';
import { useT } from '../../src/i18n';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { updatePassword } from '../../src/auth/email.ts';
import { PASSWORD_RULE_TEXT, validatePasswordConfirm } from '../../src/domain/password.ts';
import { useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Field } from '../../src/ui/Field';
import { Screen } from '../../src/ui/Screen';

export default function ResetPasswordScreen() {
  const t = useT();
  const { colors, space, font } = useTokens();
  const { session, endPasswordReset, linkError } = useAuth();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const check = validatePasswordConfirm(password, confirm);

  async function onSubmit() {
    setErrors([]);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setBusy(true);
    let result;
    try {
      result = await updatePassword(password);
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setErrors([result.error.message]);
      return;
    }
    // 게이트가 붙잡고 있던 것을 풀면 세션이 있으므로 홈으로 간다.
    endPasswordReset();
  }

  return (
    <Screen scroll edges={{ top: false }}>
      <View style={{ gap: space.lg }}>
        <Text style={{ color: colors.textMuted, fontSize: font.body, lineHeight: 22 }}>
          {t('auth.newPasswordHint')}
        </Text>

        {linkError && (
          <Text style={{ color: colors.danger, fontSize: font.caption }}>{linkError}</Text>
        )}

        {!session && !linkError && (
          <Text style={{ color: colors.danger, fontSize: font.caption }}>
            {t('auth.linkNotReady')}
          </Text>
        )}

        <Field
          label={t('auth.newPassword')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          hint={PASSWORD_RULE_TEXT}
          autoFocus
        />
        <Field
          label={t('auth.newPasswordConfirm')}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
        />

        {errors.map((e) => (
          <Text key={e} style={{ color: colors.danger, fontSize: font.caption }}>
            {e}
          </Text>
        ))}

        <Button
          label={t('auth.changePassword')}
          onPress={() => void onSubmit()}
          disabled={!check.ok || busy || !session}
          loading={busy}
        />

        {/* 링크가 만료됐거나 교환이 실패하면 이 화면이 막다른 골목이 된다. 나갈 길을 둔다 */}
        <Button
          label={t('auth.toSignIn')}
          variant="secondary"
          onPress={() => {
            endPasswordReset();
            router.replace('/sign-in');
          }}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}
