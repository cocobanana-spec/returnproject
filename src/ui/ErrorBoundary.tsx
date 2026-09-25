// 렌더 오류를 잡아 화면에 보여 주는 경계 — 릴리스에서 앱이 통째로 꺼지는 것을 막는다
//
// 배경. 2026-09-25 실기기 빌드 9에서 더보기 → 사람을 누르자 앱이 꺼졌다. 기기 크래시 로그
// (`app-2026-09-25-205745.ips`)를 받아 보니 EXC_CRASH(SIGABRT)이고 호출 흐름이
// `RCTExceptionsManager reportFatal → abort()`였다. 즉 처리되지 않은 자바스크립트 예외다.
//
// 개발 번들에서는 같은 예외가 빨간 화면으로 뜨고 앱은 살아 있어서 재현이 되지 않았다.
// 릴리스에는 그 오버레이가 없어 곧바로 죽고, 크래시 로그에는 JS 메시지가 담기지 않는다
// (bug_type 309). 그래서 원인을 알 방법이 없었다.
//
// 경계를 두면 두 가지가 한 번에 해결된다. 사용자는 앱이 꺼지지 않아 다른 화면으로 갈 수 있고,
// 오류 메시지가 화면에 남아 무엇이 터졌는지 그대로 읽을 수 있다.
import { Component, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null; info: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // 릴리스에도 남는다. 기기를 붙여 콘솔을 보면 그대로 읽힌다.
    console.error('[ErrorBoundary]', error?.message, info?.componentStack);
    this.setState({ info: info?.componentStack ?? null });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    // 토큰 훅은 함수 컴포넌트 전용이라 여기서는 고정 색을 쓴다.
    // 경계 자신이 또 터지면 안 되므로 의존을 최소로 둔다.
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', padding: 24, gap: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#111111', marginTop: 48 }}>
          화면을 그리다 문제가 생겼습니다
        </Text>
        <Text style={{ fontSize: 15, color: '#555555' }}>
          앱은 계속 쓸 수 있습니다. 아래 내용을 알려 주시면 원인을 찾는 데 도움이 됩니다.
        </Text>
        <ScrollView
          style={{ flex: 1, backgroundColor: '#F4F4F4', borderRadius: 12, padding: 12 }}
          contentContainerStyle={{ paddingBottom: 12 }}
        >
          <Text selectable style={{ fontSize: 13, color: '#111111' }}>
            {String(error?.message ?? error)}
          </Text>
          {info ? (
            <Text selectable style={{ fontSize: 11, color: '#666666', marginTop: 12 }}>
              {info.trim()}
            </Text>
          ) : null}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          onPress={this.reset}
          style={{ backgroundColor: '#111111', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }
}
