// 확인·알림 창. 웹에서는 브라우저 대화상자를 쓰고 앱에서는 Alert 을 쓴다
//
// **react-native-web 의 `Alert.alert` 은 빈 함수다**(dist/exports/Alert/index.js).
// 그래서 웹에서 확인 창에 기대던 동작이 전부 조용히 사라졌다 — 로그아웃 버튼이 죽은 것처럼
// 보이고, 기록 저장이 오류도 토스트도 없이 멈췄다(2026-09-26 QA 중대).
//
// 화면은 이 모듈만 부르고 플랫폼을 모른다. 분기는 isWeb 하나만 본다.
// 창을 닫거나 취소하면 false 다 — **아무 일도 일어나지 않는 결과는 없어야 한다.**
import { Alert } from 'react-native';
import { isWeb } from './platform.ts';

function joined(title: string, message?: string): string {
  return message ? `${title}\n\n${message}` : title;
}

// 단순 알림. 확인을 누를 때까지 기다린다(닫은 뒤 화면을 옮겨야 하는 곳이 있다).
export function notify(title: string, message?: string): Promise<void> {
  if (isWeb) {
    window.alert(joined(title, message));
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: '확인', onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // 되돌릴 수 없는 동작이면 버튼이 빨개진다. **경고 문장은 여기서 만들지 않는다** —
  // "되돌릴 수 없습니다" 같은 말은 부르는 쪽이 message 에 직접 적는다. 그래야 웹과 앱에서
  // 똑같이 보인다(웹 꼬리말로만 붙이면 앱에서는 그 말이 사라진다 — 2026-09-26 QA 중대).
  destructive?: boolean;
};

export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  if (isWeb) {
    // window.confirm 은 예/아니오뿐이라 버튼 이름을 보여 줄 수 없다. 그래서 무엇을 하는
    // 확인인지 본문에 적어 준다. 버튼 이름이 "나가기", "삭제"처럼 명사라 조사를 붙이면
    // 어색해진다. 따옴표로 묶고 "을(를) 진행합니다"로 두어 어떤 이름에도 맞게 한다.
    const label = opts.confirmLabel ?? '확인';
    const tail = `\n\n[확인]을 누르면 "${label}"을(를) 진행합니다.`;
    return Promise.resolve(window.confirm(joined(opts.title, opts.message) + tail));
  }
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: opts.cancelLabel ?? '취소', style: 'cancel', onPress: () => resolve(false) },
        {
          text: opts.confirmLabel ?? '확인',
          style: opts.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
