// 계정 삭제(S16)가 장부마다 무엇을 하는지 미리 보여 주기 위한 계산
//
// 되돌릴 수 없는 조작이라 "일반론"으로 안내하면 안 된다. 실제 내 장부 목록과 구성원 수에 근거해
// 장부마다 데이터까지 사라지는지, 나만 빠지는지를 이름과 함께 보여 준다(docs/03 §6.2 규칙과 같다).
export type LedgerForDeletion = {
  ledgerId: string;
  name: string;
  memberCount: number;
};

export type DeletionOutcome = {
  ledgerId: string;
  name: string;
  // delete = 혼자 쓰던 장부라 데이터까지 사라진다. leave = 함께 쓰는 장부라 나만 빠진다.
  kind: 'delete' | 'leave';
  remainingMembers: number;
};

export function accountDeletionPlan(ledgers: LedgerForDeletion[]): DeletionOutcome[] {
  return ledgers.map((l) => ({
    ledgerId: l.ledgerId,
    name: l.name,
    kind: l.memberCount <= 1 ? 'delete' : 'leave',
    remainingMembers: Math.max(0, l.memberCount - 1),
  }));
}

export function outcomeLine(outcome: DeletionOutcome): string {
  if (outcome.kind === 'delete') {
    return `· "${outcome.name}" — 장부와 기록이 모두 삭제됩니다.`;
  }
  return `· "${outcome.name}" — 나만 빠지고 기록은 남은 구성원 ${outcome.remainingMembers}명에게 남습니다.`;
}

export function deletionDialogBody(plan: DeletionOutcome[]): string {
  if (plan.length === 0) {
    return '계정을 삭제합니다. 되돌릴 수 없습니다.';
  }
  return [...plan.map(outcomeLine), '', '되돌릴 수 없습니다.'].join('\n');
}
