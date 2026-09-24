// 계정 삭제 안내 단위 테스트. 장부마다 결과가 다르다는 것을 문구로 보여 주는지 본다
import test from 'node:test';
import assert from 'node:assert/strict';
import { accountDeletionPlan, deletionDialogBody, outcomeLine } from './account.ts';

test('혼자 쓰는 장부는 삭제로 분류된다', () => {
  const plan = accountDeletionPlan([{ ledgerId: 'L1', name: '내 장부', memberCount: 1 }]);
  assert.equal(plan[0]?.kind, 'delete');
  assert.equal(plan[0]?.remainingMembers, 0);
});

test('함께 쓰는 장부는 나만 빠지는 것으로 분류된다', () => {
  const plan = accountDeletionPlan([{ ledgerId: 'L1', name: '우리 집 장부', memberCount: 2 }]);
  assert.equal(plan[0]?.kind, 'leave');
  assert.equal(plan[0]?.remainingMembers, 1);
});

test('장부 두 권이면 결과가 섞인다', () => {
  const plan = accountDeletionPlan([
    { ledgerId: 'L1', name: '우리 집 장부', memberCount: 2 },
    { ledgerId: 'L2', name: '내 장부', memberCount: 1 },
  ]);
  assert.deepEqual(plan.map((p) => p.kind), ['leave', 'delete']);
});

test('문구에 장부 이름이 들어간다', () => {
  const line = outcomeLine({ ledgerId: 'L1', name: '우리 집 장부', kind: 'leave', remainingMembers: 1 });
  assert.ok(line.includes('우리 집 장부'));
  assert.ok(line.includes('1명'));
});

test('삭제되는 장부는 기록까지 사라진다고 적는다', () => {
  const line = outcomeLine({ ledgerId: 'L1', name: '내 장부', kind: 'delete', remainingMembers: 0 });
  assert.ok(line.includes('모두 삭제'));
});

test('본문은 장부마다 한 줄씩 만든다', () => {
  const body = deletionDialogBody(
    accountDeletionPlan([
      { ledgerId: 'L1', name: 'A', memberCount: 1 },
      { ledgerId: 'L2', name: 'B', memberCount: 3 },
    ]),
  );
  assert.ok(body.includes('"A"'));
  assert.ok(body.includes('"B"'));
  assert.ok(body.includes('되돌릴 수 없습니다.'));
});

test('장부가 없어도 안내는 나간다', () => {
  assert.ok(deletionDialogBody([]).includes('되돌릴 수 없습니다.'));
});
