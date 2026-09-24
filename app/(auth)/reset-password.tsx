// 새 비밀번호 입력 화면 — 재설정 링크로 들어왔을 때만 열린다
//
// 링크 교환으로 세션이 이미 생겨 있지만, 비밀번호를 바꾸기 전까지는 게이트가 홈으로 보내지 않는다
// (AuthProvider의 resetPending). 여기서 바꾸면 resetPending을 내리고 홈으로 간다.
import { useRouter } from 'expo-router';
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
          새로 쓸 비밀번호를 정해 주세요.
        </Text>

        {linkError && (
          <Text style={{ color: colors.danger, fontSize: font.caption }}>{linkError}</Text>
        )}

        {!session && !linkError && (
          <Text style={{ color: colors.danger, fontSize: font.caption }}>
            링크 확인이 끝나지 않았습니다. 메일의 링크를 다시 눌러 주세요.
          </Text>
        )}

        <Field
          label="새 비밀번호"
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
          label="새 비밀번호 확인"
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
          label="비밀번호 바꾸기"
          onPress={() => void onSubmit()}
          disabled={!check.ok || busy || !session}
          loading={busy}
        />

        {/* 링크가 만료됐거나 교환이 실패하면 이 화면이 막다른 골목이 된다. 나갈 길을 둔다 */}
        <Button
          label="로그인 화면으로"
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
