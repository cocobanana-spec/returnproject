// 로그인 화면(S00). 소셜 3종 버튼만 있는 최소 셸이며 실제 로그인은 아직 검증되지 않았다
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AUTH_PROVIDERS,
  AUTH_PROVIDER_LABEL,
  signInWith,
  type AuthProviderId,
} from '../../src/auth/providers';
import { useOnline } from '../../src/lib/useOnline';
import { useTokens } from '../../src/theme/tokens';

export default function SignInScreen() {
  const { colors, space, font, radius } = useTokens();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const [busy, setBusy] = useState<AuthProviderId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onPress(provider: AuthProviderId) {
    setMessage(null);
    setBusy(provider);
    const result = await signInWith(provider);
    setBusy(null);
    if (result.status === 'error') setMessage(result.message);
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.bg, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text, fontSize: font.display }]}>뿌린대로거두리라</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: font.body, marginTop: space.sm }]}>
          경조사로 주고받은 마음을 사람 단위로 기록합니다.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        {!online && (
          <Text style={[styles.notice, { color: colors.danger, fontSize: font.caption }]}>
            인터넷 연결이 필요합니다.
          </Text>
        )}
        {message && (
          <Text style={[styles.notice, { color: colors.danger, fontSize: font.caption }]}>{message}</Text>
        )}
        {AUTH_PROVIDERS.map((provider) => (
          <Pressable
            key={provider}
            disabled={busy !== null || !online}
            onPress={() => void onPress(provider)}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: colors.accent,
                borderRadius: radius.md,
                paddingVertical: space.lg,
                opacity: pressed || busy !== null || !online ? 0.6 : 1,
              },
            ]}
          >
            {busy === provider ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <Text style={{ color: colors.textOnAccent, fontSize: font.body, fontWeight: '600' }}>
                {AUTH_PROVIDER_LABEL[provider]}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  header: { flex: 1, justifyContent: 'center' },
  title: { fontWeight: '700' },
  subtitle: { lineHeight: 22 },
  button: { alignItems: 'center', justifyContent: 'center' },
  notice: { textAlign: 'center' },
});
