// 조회가 실패했을 때의 안내. 빈 상태와 반드시 구분해서 보여 준다
//
// 네트워크·만료 토큰·RLS는 전부 "빈 결과"처럼 보인다. 그걸 온보딩 문구로 덮으면 사용자는
// 자기 기록이 사라진 줄 안다(context-notes §11.1의 교훈). 그래서 "사라진 것은 아니다"를
// 문구에 못 박고 다시 시도 버튼을 함께 둔다.
import { Text, View } from 'react-native';
import { Button } from './Button';
import { useTokens } from '../theme/tokens';

type Props = {
  title?: string;
  onRetry?: () => void;
};

export function LoadFailed({ title = '불러오지 못했습니다', onRetry }: Props) {
  const { colors, space, font } = useTokens();
  return (
    <View style={{ gap: space.md, paddingVertical: space.xxl }}>
      <Text style={{ color: colors.danger, fontSize: font.body, textAlign: 'center' }}>{title}</Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: font.caption,
          lineHeight: 20,
          textAlign: 'center',
        }}
      >
        연결을 확인하고 다시 시도해 주세요. 기록이 사라진 것은 아닙니다.
      </Text>
      {onRetry && <Button label="다시 시도" variant="secondary" onPress={onRetry} />}
    </View>
  );
}
