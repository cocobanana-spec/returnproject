// 디자인 리뉴얼 미리보기 — 공통 컴포넌트만 모아 본다. 메뉴에서 안 보이고 주소(/design-preview)로만 연다. 3단계 끝나면 지운다
import { ScrollView, Text, View } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { amountText, amountTextLarge, useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { Chip } from '../../src/ui/Chip';
import { Field } from '../../src/ui/Field';
import { ListRow } from '../../src/ui/ListRow';
import { SectionHeader } from '../../src/ui/SectionHeader';

export default function DesignPreview() {
  const { colors, space, font } = useTokens();
  const insets = useSafeAreaInsets();
  const [chip, setChip] = useState('결혼식');
  const brand = process.env.EXPO_PUBLIC_BRAND === 'blue' ? 'blue #3182F6' : 'green #22C55E';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ gap: space.xxl, paddingBottom: insets.bottom + 120, paddingHorizontal: space.xl, paddingTop: insets.top + space.xl }}>
      <View style={{ gap: space.xs }}>
        <Text style={{ color: colors.textMuted, fontSize: font.caption }}>brand = {brand}</Text>
        <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>컴포넌트 미리보기</Text>
      </View>

      <View>
        <SectionHeader title="타이포" />
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>지금까지 주고받은 마음</Text>
          <Text style={{ ...amountTextLarge, color: colors.text, fontSize: font.display, fontWeight: '800', marginTop: space.xs }}>+500,000원</Text>
          <View style={{ borderTopColor: colors.border, borderTopWidth: 1, marginVertical: space.lg }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.textMuted, fontSize: font.body, fontWeight: '500' }}>보낸 축의금·조의금</Text>
            <Text style={{ ...amountText, color: colors.given, fontSize: font.title, fontWeight: '700' }}>550,000원</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md }}>
            <Text style={{ color: colors.textMuted, fontSize: font.body, fontWeight: '500' }}>받은 축의금·조의금</Text>
            <Text style={{ ...amountText, color: colors.received, fontSize: font.title, fontWeight: '700' }}>1,050,000원</Text>
          </View>
        </Card>
      </View>

      <View>
        <SectionHeader title="최근 기록" actionLabel="더보기" onAction={() => {}} />
        <Card padded={false}>
          <ListRow icon="heart" title="김민준 · 회사" caption="김민준 결혼식 · 2026.03.14" value="10만원" onPress={() => {}} />
          <ListRow icon="flower" title="윤도현" caption="박지호 장례식 · 2025.11.20" value="20만원" onPress={() => {}} />
          <ListRow icon="gift" title="이서연 · 대학" caption="이서연 돌잔치 · 2026.05.02" value="5만원" onPress={() => {}} />
        </Card>
      </View>

      <View>
        <SectionHeader title="메뉴 행" />
        <Card padded={false}>
          <ListRow icon="calendar" title="행사" caption="내 행사 만들기, 명부 입력" chevron onPress={() => {}} />
          <ListRow icon="cloud-upload" title="가져오기" caption="엑셀·CSV 파일로 한 번에" chevron onPress={() => {}} />
          <ListRow icon="trash" iconTone="danger" title="모든 기록 삭제" caption="되돌릴 수 없어요" chevron onPress={() => {}} />
        </Card>
      </View>

      <View style={{ gap: space.md }}>
        <SectionHeader title="버튼" />
        <Button label="기록하기" onPress={() => {}} interactive />
        <Button label="코드로 참여" variant="secondary" onPress={() => {}} />
        <Button label="이 기록 지우기" variant="danger" onPress={() => {}} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="작은 버튼" size="sm" onPress={() => {}} />
          <Button label="작은 보조" variant="secondary" size="sm" onPress={() => {}} />
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <SectionHeader title="칩" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {['결혼식', '돌잔치', '장례식', '생일'].map((c) => (
            <Chip key={c} label={c} selected={chip === c} onPress={() => setChip(c)} />
          ))}
          <Chip label="청첩장 공개 중" tone="accent" onPress={() => {}} />
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <SectionHeader title="입력" />
        <Card>
          <Field label="이름" placeholder="이름" />
          <View style={{ height: space.md }} />
          <Field label="금액" placeholder="직접 입력" keyboardType="number-pad" />
        </Card>
      </View>
    </ScrollView>
  );
}
