// 화면 아래에 잠깐 떠서 결과를 알리는 띠. 실행 취소 같은 되돌리기 버튼을 함께 둘 수 있다
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CONTENT_MAX_WIDTH } from './webLayout.ts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTokens } from '../theme/tokens';

type Toast = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

type ToastApi = { show: (toast: Toast) => void; hide: () => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { colors, space, font, radius } = useTokens();
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (next: Toast) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(next);
      timer.current = setTimeout(() => setToast(null), next.durationMs ?? 5000);
    },
    [],
  );

  const api = useMemo<ToastApi>(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <View
          pointerEvents="box-none"
          style={{
            // 토스트만 폭 제한 밖이라 넓은 화면에서 창 전체로 퍼졌다. 가운데로 모은다.
            alignItems: 'center',
            position: 'absolute',
            left: 0,
            right: 0,
            paddingHorizontal: space.lg,
            bottom: insets.bottom + space.xxl + space.lg,
          }}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: colors.accent,
              maxWidth: CONTENT_MAX_WIDTH,
              width: '100%',
              borderRadius: radius.md,
              flexDirection: 'row',
              gap: space.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
            }}
          >
            <Text style={{ color: colors.textOnAccent, fontSize: font.caption, flex: 1 }}>
              {toast.message}
            </Text>
            {toast.actionLabel && toast.onAction && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const action = toast.onAction;
                  hide();
                  action?.();
                }}
              >
                <Text style={{ color: colors.textOnAccent, fontSize: font.caption, fontWeight: '700' }}>
                  {toast.actionLabel}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('ToastProvider 안에서만 쓸 수 있다.');
  return api;
}
