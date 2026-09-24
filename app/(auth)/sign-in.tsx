// 로그인 화면(S00) — 메일·비밀번호와 소셜 2종. 로그인 없이 쓰는 경로는 없다
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { signInWithEmail } from '../../src/auth/email.ts';
import { repeatedFailureHint } from '../../src/auth/errors.ts';
import {
  AUTH_PROVIDERS,
  AUTH_PROVIDER_LABEL,
  signInWith,
  type AuthProviderId,
} from '../../src/auth/providers';
import { isLikelyEmail } from '../../src/domain/password.ts';
import { useOnline } from '../../src/lib/useOnline';
import { useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Field } from '../../src/ui/Field';

export default function SignInScreen() {
  const { colors, space, font } = useTokens();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const online = useOnline();
  const { linkError, clearLinkError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);

  const canSubmit = isLikelyEmail(email) && password.length > 0;

  async function onEmailSignIn() {
    setMessage(null);
    clearLinkError();
    setBusy('email');
    try {
      const result = await signInWithEmail(email, password);
      if (result.ok) {
        setFailCount(0);
        return;
      }
      setFailCount((n) => n + 1);
      setMessage(result.error.message);
      // 메일 확인이 안 끝난 계정이면 대기 화면으로 보내 재발송을 쓸 수 있게 한다.
      if (result.error.kind === 'email_not_confirmed') {
        router.push({ pathname: '/check-email', params: { email } });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onProvider(provider: AuthProviderId) {
    setMessage(null);
    clearLinkError();
    setBusy(provider);
    try {
      const result = await signInWith(provider);
      if (result.status === 'error') setMessage(result.message);
    } finally {
      setBusy(null);
    }
  }

  const hint = repeatedFailureHint(failCount);
  const shown = message ?? linkError;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + space.xxl,
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.xl,
      }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        <View>
          <Text style={{ color: colors.text, fontSize: font.display, fontWeight: '700' }}>
            뿌린대로거두리라
          </Text>
          <Text
            style={{ color: colors.textMuted, fontSize: font.body, lineHeight: 24, marginTop: space.md }}
          >
            경조사로 주고받은 마음을{'\n'}사람 단위로 기록합니다.
          </Text>
        </View>

        <View style={{ gap: space.md }}>
          {!online && (
            <Text style={{ color: colors.danger, fontSize: font.caption, textAlign: 'center' }}>
              인터넷에 연결되어 있지 않습니다.
            </Text>
          )}
          {shown && (
            <Text style={{ color: colors.danger, fontSize: font.caption, textAlign: 'center' }}>
              {shown}
            </Text>
          )}
          {hint && (
            <Text style={{ color: colors.textMuted, fontSize: font.caption, textAlign: 'center' }}>
              {hint}
            </Text>
          )}

          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="메일 주소"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
          />

          <Button
            label="로그인"
            onPress={() => void onEmailSignIn()}
            disabled={!canSubmit || busy !== null}
            loading={busy === 'email'}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }}>
            <Pressable onPress={() => router.push('/sign-up')} hitSlop={8}>
              <Text style={{ color: colors.text, fontSize: font.caption, fontWeight: '600' }}>
                회원가입
              </Text>
            </Pressable>
            <Text style={{ color: colors.border, fontSize: font.caption }}>|</Text>
            <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                비밀번호를 잊었어요
              </Text>
            </Pressable>
          </View>

          <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
            <View style={{ backgroundColor: colors.border, flex: 1, height: 1 }} />
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>또는</Text>
            <View style={{ backgroundColor: colors.border, flex: 1, height: 1 }} />
          </View>

          {AUTH_PROVIDERS.map((provider) => (
            <Button
              key={provider}
              label={AUTH_PROVIDER_LABEL[provider]}
              variant="secondary"
              onPress={() => void onProvider(provider)}
              disabled={busy !== null}
              loading={busy === provider}
            />
          ))}
        </View>
      </View>

      <Text
        style={{
          color: colors.textMuted,
          fontSize: font.caption,
          textAlign: 'center',
          lineHeight: 18,
          marginTop: space.lg,
        }}
      >
        로그인하면 개인정보 처리방침에 동의하는 것으로 봅니다.
      </Text>
    </ScrollView>
  );
}
