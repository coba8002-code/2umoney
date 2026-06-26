import type { ScanResult, FixSuggestion } from '@app/core';

/** UI(iframe) → 메인(코드) 메시지 */
export type UiToMain =
  | { type: 'scan'; scope: 'selection' | 'page' }
  | { type: 'apply-fix'; nodeId: string; ruleId: string }
  | { type: 'apply-all-color' }
  | { type: 'highlight'; nodeId: string }
  | { type: 'resize'; width: number; height: number };

/** 메인(코드) → UI(iframe) 메시지 */
export type MainToUi =
  | { type: 'scan-result'; result: ScanResult; scope: string }
  | { type: 'applied'; nodeId: string; ruleId: string; ok: boolean; message: string }
  | { type: 'error'; message: string };

export interface PendingFix {
  nodeId: string;
  ruleId: string;
  fix: FixSuggestion;
}
