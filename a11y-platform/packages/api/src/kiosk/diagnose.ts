/**
 * ③ 키오스크 화면 진단 코어 — 검출 요소 + 보정 → 기준별 판정 → 실행형 리포트.
 * 색·크기는 결정론(@app/core), 기준 메타는 @app/kiosk-criteria. AI 판단은 상위에서 주입.
 */
import {
  contrastRatio,
  calibrationFromScreenSpec,
  noCalibration,
  hasScale,
  pxToMm,
  judgeMbr,
  type Calibration,
} from '@app/core';
import { getCriterion } from '@app/kiosk-criteria';
import type {
  KioskScreen,
  KioskElement,
  KioskFinding,
  KioskReport,
  Remedy,
  Importance,
} from './types';

// 기준 → 수선 분류(휴리스틱)
const REMEDY: Record<string, Remedy> = {
  'kiosk.contrast': 'S/W',
  'kiosk.text.size': 'S/W',
  'kiosk.color.independence': 'S/W',
  'kiosk.control.label': 'S/W',
  'kiosk.ui.distinguish': 'S/W',
  'kiosk.button.mbr': 'H/W',
  'kiosk.button.gap': 'H/W',
  'kiosk.audio.volumeControl': 'H/W',
  'kiosk.wheelchair.reach': '운영',
  'kiosk.time.limit': 'S/W',
};

// 기준 → 중요도
const IMPORTANCE: Record<string, Importance> = {
  'kiosk.contrast': 'critical',
  'kiosk.button.mbr': 'critical',
  'kiosk.control.label': 'critical',
  'kiosk.keyboard.navigation': 'critical',
  'kiosk.text.size': 'high',
  'kiosk.color.independence': 'high',
  'kiosk.time.limit': 'high',
};

// 카테고리 → 영향 사용자 유형
const USER_TYPES: Record<string, string[]> = {
  hand: ['지체·상지장애', '고령'],
  response: ['고령', '인지·발달'],
  sight: ['저시력', '전맹', '고령'],
  hearing: ['청각장애'],
  cognition: ['고령', '인지·발달'],
  io: ['지체(휠체어)', '고령'],
};

function meta(id: string): { title: string; clause: string[]; source: KioskFinding['source']; category: string } {
  const c = getCriterion(id);
  return {
    title: c?.titleKo ?? id,
    clause: c?.clause ?? [],
    source: c?.source ?? 'ai-assisted',
    category: c?.category ?? 'sight',
  };
}

function mkFinding(id: string, el: KioskElement | undefined, status: KioskFinding['status'], detail: string, extra: Partial<KioskFinding> = {}): KioskFinding {
  const m = meta(id);
  return {
    criterionId: id,
    criterionTitle: m.title,
    clause: m.clause,
    elementId: el?.id,
    status,
    source: extra.source ?? m.source,
    importance: IMPORTANCE[id] ?? 'medium',
    remedy: REMEDY[id] ?? 'S/W',
    userTypes: USER_TYPES[m.category] ?? [],
    detail,
    ...extra,
  };
}

function buildCalibration(screen: KioskScreen): Calibration {
  if (screen.calibration) return screen.calibration;
  if (screen.screenSpec) return calibrationFromScreenSpec(screen.screenSpec);
  return noCalibration();
}

export function diagnoseKioskScreen(screen: KioskScreen): KioskReport {
  const cal = buildCalibration(screen);
  const findings: KioskFinding[] = [];

  for (const el of screen.elements) {
    // 명도 대비 (텍스트/컨트롤 색이 있으면)
    if ((el.kind === 'text' || el.kind === 'button' || el.kind === 'control') && el.fgColor && el.bgColor) {
      const ratio = contrastRatio(el.fgColor, el.bgColor);
      findings.push(
        mkFinding('kiosk.contrast', el, ratio >= 4.5 ? '적합' : '부적합', `명도 대비 ${ratio.toFixed(2)}:1 (기준 4.5:1)`, {
          source: 'auto',
          confidence: 'high',
          evidence: { ratio: Number(ratio.toFixed(2)), required: 4.5 },
        }),
      );
    }

    // 버튼/컨트롤 최소 크기 MBR
    if (el.kind === 'button' || el.kind === 'control') {
      const r = judgeMbr(cal, { widthPx: el.boxPx.widthPx, heightPx: el.boxPx.heightPx });
      const status = r.confidence === 'none' ? '실측필요' : r.pass ? '적합' : '부적합';
      findings.push(
        mkFinding('kiosk.button.mbr', el, status, r.reason, {
          source: r.confidence === 'none' ? 'manual' : 'ai-assisted',
          confidence: r.confidence,
          evidence: hasScale(cal) ? { sideMinMm: Number(r.sideMinMm.toFixed(1)), areaMm2: Number(r.areaMm2.toFixed(0)) } : undefined,
        }),
      );

      // 레이블 유무
      if (!el.label) {
        findings.push(mkFinding('kiosk.control.label', el, '부적합', '컨트롤에 접근성 레이블이 없습니다.', { source: 'ai-assisted', confidence: 'medium' }));
      }
    }

    // 텍스트 실제 높이 7.25mm
    if (el.kind === 'text' && el.charHeightPx) {
      if (!hasScale(cal)) {
        findings.push(mkFinding('kiosk.text.size', el, '실측필요', '스케일 근거가 없어 문자 높이를 판정할 수 없습니다.', { source: 'manual', confidence: 'none' }));
      } else {
        const hMm = pxToMm(cal, el.charHeightPx);
        findings.push(
          mkFinding('kiosk.text.size', el, hMm >= 7.25 ? '적합' : '부적합', `문자 높이 ${hMm.toFixed(1)}mm (기준 7.25mm)`, {
            source: 'ai-assisted',
            confidence: cal.confidence,
            evidence: { charHeightMm: Number(hMm.toFixed(2)), required: 7.25 },
          }),
        );
      }
    }

    // 색 독립성(비전이 색-단독 의미 사용을 지적한 경우)
    if (el.colorOnlyMeaning) {
      findings.push(mkFinding('kiosk.color.independence', el, '부적합', '색이 정보 구분의 유일한 수단으로 사용된 것으로 보입니다.', { source: 'ai-assisted', confidence: 'medium' }));
    }
  }

  // 집계
  const count = (s: string) => findings.filter((f) => f.status === s).length;
  const 적합 = count('적합');
  const 부적합 = count('부적합');
  const auto = 적합 + 부적합;
  const order: Record<Importance, number> = { critical: 0, high: 1, medium: 2 };
  const priorities = findings
    .filter((f) => f.status === '부적합')
    .sort((a, b) => order[a.importance] - order[b.importance]);

  const remedyBreakdown: Record<Remedy, number> = { 'S/W': 0, 'H/W': 0, 운영: 0 };
  for (const f of priorities) remedyBreakdown[f.remedy]++;

  return {
    summary: {
      total: findings.length,
      적합,
      부적합,
      실측필요: count('실측필요'),
      판정불가: count('판정불가'),
      passRateAuto: auto > 0 ? Number((적합 / auto).toFixed(3)) : 1,
      passRateLabel: '자동판정 가능 항목 기준(전체 접근성 보장 아님)',
    },
    priorities,
    findings,
    remedyBreakdown,
    guardrail:
      'AI·자동 판정은 보조 수단입니다. 실측필요·수동 항목과 최종 적합/부적합은 사람이 검수해야 합니다.',
  };
}
