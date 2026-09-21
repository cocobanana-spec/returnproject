// 로그인 화면(S00). 소셜 3종 버튼이 전부이며 로그인 없이 쓰는 경로는 없다
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AUTH_PROVIDERS,
  AUTH_PROVIDER_LABEL,
  signInWith,
  type AuthProviderId,
} from '../../src/auth/providers';
import { DEV_SIGN_IN_AUTO, DEV_SIGN_IN_ENABLED, devSignIn } from '../../src/auth/devSignIn';
import { useOnline } from '../../src/lib/useOnline';
import { Button } from '../../src/ui/Button';
import { useTokens } from '../../src/theme/tokens';

export default function SignInScreen() {
  const { colors, space, font } = useTokens();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onProvider(provider: AuthProviderId) {
    setMessage(null);
    setBusy(provider);
    const result = await signInWith(provider);
    setBusy(null);
    if (result.status === 'error') setMessage(result.message);
  }

  async function onDev() {
    setMessage(null);
    setBusy('dev');
    const result = await devSignIn();
    setBusy(null);
    if (!result.ok) setMessage(result.message);
  }

  // 스크린샷 검증용 자동 로그인. EXPO_PUBLIC_DEV_SIGNIN=auto 일 때만 돈다.
  useEffect(() => {
    if (DEV_SIGN_IN_AUTO) void onDev();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top + space.xxl,
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.xl,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xxl }}>
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
          {message && (
            <Text style={{ color: colors.danger, fontSize: font.caption, textAlign: 'center' }}>
              {message}
            </Text>
          )}

          {AUTH_PROVIDERS.map((provider) => (
            <Button
              key={provider}
              label={AUTH_PROVIDER_LABEL[provider]}
              onPress={() => void onProvider(provider)}
              disabled={busy !== null}
              loading={busy === provider}
            />
          ))}

          {DEV_SIGN_IN_ENABLED && (
            <Button
              label="개발용 메일 로그인"
              variant="secondary"
              onPress={() => void onDev()}
              disabled={busy !== null}
              loading={busy === 'dev'}
            />
          )}
        </View>
      </View>

      <Text
        style={{
          color: colors.textMuted,
          fontSize: font.caption,
          textAlign: 'center',
          lineHeight: 18,
        }}
      >
        로그인하면 개인정보 처리방침에 동의하는 것으로 봅니다.
      </Text>
    </View>
  );
}
