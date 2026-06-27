import type { ScanResult, FixSuggestion } from '@app/core';

/** UI(iframe) → 메인(코드) 메시지 */
export type UiToMain =
  | { type: 'scan'; scope: 'selection' | 'page' }
  | { type: 'apply-fix'; nodeId: string; ruleId: string }
  | { type: 'apply-all-color' }
  | { type: 'undo' } // B4: 마지막 보정 묶음 되돌리기
  | { type: 'highlight'; nodeId: string }
  | { type: 'resize'; width: number; height: number };

/** 메인(코드) → UI(iframe) 메시지 */
export type MainToUi =
  | { type: 'scan-result'; result: ScanResult; scope: string; paletteSize: number }
  | { type: 'applied'; nodeId: string; ruleId: string; ok: boolean; message: string }
  | { type: 'undo-state'; depth: number } // B4: 되돌리기 가능 단계 수
  | { type: 'error'; message: string };

export interface PendingFix {
  nodeId: string;
  ruleId: string;
  fix: FixSuggestion;
}
