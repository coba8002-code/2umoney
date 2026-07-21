/**
 * ③ 키오스크 화면 진단 입력·출력 모델.
 * 이미지→요소 검출(Vision AI)은 상위에서 수행하고, 여기서는 검출된 요소 + 보정으로
 * 기준을 결정론적으로 판정한다(테스트 가능). 미검출·실측필요는 명시적으로 분리.
 */
import type { Calibration } from '@app/core';

export type KioskElementKind = 'button' | 'control' | 'text' | 'icon' | 'image' | 'container';

export interface KioskBox {
  x: number;
  y: number;
  widthPx: number;
  heightPx: number;
}

export interface KioskElement {
  id: string;
  kind: KioskElementKind;
  boxPx: KioskBox;
  /** 텍스트/전경 색(hex) */
  fgColor?: string;
  /** 배경 색(hex) */
  bgColor?: string;
  /** OCR 텍스트 */
  text?: string;
  /** 측정된 글자 높이(px) — text.size 판정용 */
  charHeightPx?: number;
  /** 접근성 레이블(있으면). null=없음 */
  label?: string | null;
  /** 색이 유일한 구분 수단으로 쓰였다고 비전이 판단 */
  colorOnlyMeaning?: boolean;
}

export interface KioskScreen {
  /** px→mm 보정(없으면 크기 계열은 '실측필요') */
  calibration?: Calibration;
  /** 보정 대신 화면 스펙을 주면 내부에서 보정 생성 */
  screenSpec?: { diagonalInch: number; widthPx: number; heightPx: number };
  elements: KioskElement[];
}

export type DiagnosisStatus = '적합' | '부적합' | '실측필요' | '판정불가';
export type Remedy = 'S/W' | 'H/W' | '운영';
export type Importance = 'critical' | 'high' | 'medium';

export interface KioskFinding {
  criterionId: string;
  criterionTitle: string;
  clause: string[];
  elementId?: string;
  status: DiagnosisStatus;
  source: 'auto' | 'ai-assisted' | 'manual';
  importance: Importance;
  remedy: Remedy;
  /** 영향받는 사용자 유형 */
  userTypes: string[];
  detail: string;
  confidence?: 'high' | 'medium' | 'low' | 'none';
  evidence?: Record<string, unknown>;
}

export interface KioskReport {
  summary: {
    total: number;
    적합: number;
    부적합: number;
    실측필요: number;
    판정불가: number;
    /** 자동판정 가능 항목 기준 통과율 */
    passRateAuto: number;
    passRateLabel: string;
  };
  /** 부적합 우선순위 순(중요도) */
  priorities: KioskFinding[];
  findings: KioskFinding[];
  /** 수선 방식별 집계 */
  remedyBreakdown: Record<Remedy, number>;
  guardrail: string;
}
