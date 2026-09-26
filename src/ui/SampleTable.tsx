// 가져오기에서 보여 주는 예시 표 — 어떤 모양의 파일을 넣으면 되는지 눈으로 알려 준다
//
// 사용자가 "예시 파일을 볼 수 있으면 더 친절하겠다"고 했다(2026-09-26).
// 이미지가 아니라 실제 표로 그린다. 이미지는 글자가 흐려지고 다크 모드에서 어색해지며,
// 열 이름이 바뀌면 그림을 다시 만들어야 한다. 여기 값은 앱이 실제로 읽어 내는 모양 그대로다.
import { Text, View } from 'react-native';
import { useTokens } from '../theme/tokens';

const HEADER = ['성함', '금액(원)', '일자', '종류'];
const ROWS = [
  ['김철수', '₩100,000', '11/15/22', '할아버지 장례식'],
  ['이영희', '50,000', '2022-11-15', '결혼식'],
  ['박민수', '10만', '22.11.15', '돌잔치'],
];

export function SampleTable() {
  const { colors, space, font, radius } = useTokens();
  const widths = [72, 92, 88, 108];

  const cell = (text: string, i: number, header: boolean) => (
    <Text
      key={i}
      numberOfLines={1}
      style={{
        width: widths[i],
        color: header ? colors.text : colors.textMuted,
        fontSize: font.caption,
        fontWeight: header ? '700' : '400',
      }}
    >
      {text}
    </Text>
  );

  return (
    <View style={{ gap: space.sm }}>
      <View
        style={{
          backgroundColor: colors.bgSubtle,
          borderRadius: radius.md,
          padding: space.md,
          gap: space.xs,
        }}
      >
        <View style={{ flexDirection: 'row' }}>{HEADER.map((h, i) => cell(h, i, true))}</View>
        <View style={{ backgroundColor: colors.border, height: 1 }} />
        {ROWS.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.map((c, i) => cell(c, i, false))}
          </View>
        ))}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
        성함과 금액만 있으면 됩니다. 일자와 종류는 없어도 되고, 없으면 다음 단계에서 한 번에 정합니다.
        금액은 ₩100,000 · 100,000 · 10만 모두 읽습니다. 번호 열은 알아서 건너뜁니다.
      </Text>
    </View>
  );
}
