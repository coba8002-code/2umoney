import { describe, it, expect } from 'vitest';
import { diagnoseKioskScreen } from '../kiosk/diagnose';
import type { KioskScreen } from '../kiosk/types';
import { calibrationFromScreenSpec } from '@app/core';

// 0.1 mm/px 가 되도록: 대각 스펙 대신 마커 상당. 여기선 스크린 스펙으로 근접값 사용.
const screenSpec = { diagonalInch: 15.6, widthPx: 1920, heightPx: 1080 }; // ≈0.18 mm/px

describe('③ 키오스크 화면 진단', () => {
  it('대비 미달 텍스트를 부적합(auto)으로 판정', () => {
    const screen: KioskScreen = {
      screenSpec,
      elements: [{ id: 't1', kind: 'text', boxPx: { x: 0, y: 0, widthPx: 100, heightPx: 20 }, fgColor: '#aaaaaa', bgColor: '#ffffff' }],
    };
    const r = diagnoseKioskScreen(screen);
    const f = r.findings.find((x) => x.criterionId === 'kiosk.contrast')!;
    expect(f.status).toBe('부적합');
    expect(f.source).toBe('auto');
    expect(f.evidence?.ratio).toBeLessThan(4.5);
  });

  it('작은 버튼을 MBR 부적합 + 레이블 없음 부적합으로 판정', () => {
    const screen: KioskScreen = {
      screenSpec, // 0.18mm/px → 40px ≈ 7.2mm < 12mm
      elements: [{ id: 'b1', kind: 'button', boxPx: { x: 0, y: 0, widthPx: 40, heightPx: 40 }, fgColor: '#fff', bgColor: '#1976d2' }],
    };
    const r = diagnoseKioskScreen(screen);
    expect(r.findings.find((f) => f.criterionId === 'kiosk.button.mbr')?.status).toBe('부적합');
    expect(r.findings.find((f) => f.criterionId === 'kiosk.control.label')?.status).toBe('부적합');
  });

  it('충분히 큰 버튼(+레이블)은 MBR 적합', () => {
    const screen: KioskScreen = {
      screenSpec, // 80px*0.18≈14.4mm ≥12, 면적 207mm² ≥144
      elements: [{ id: 'b2', kind: 'button', label: '결제', boxPx: { x: 0, y: 0, widthPx: 80, heightPx: 80 }, fgColor: '#fff', bgColor: '#1565c0' }],
    };
    const r = diagnoseKioskScreen(screen);
    expect(r.findings.find((f) => f.criterionId === 'kiosk.button.mbr')?.status).toBe('적합');
    expect(r.findings.some((f) => f.criterionId === 'kiosk.control.label')).toBe(false);
  });

  it('보정 근거가 없으면 크기 판정은 실측필요(manual)', () => {
    const screen: KioskScreen = {
      elements: [{ id: 'b3', kind: 'button', label: 'x', boxPx: { x: 0, y: 0, widthPx: 200, heightPx: 200 } }],
    };
    const r = diagnoseKioskScreen(screen);
    const f = r.findings.find((x) => x.criterionId === 'kiosk.button.mbr')!;
    expect(f.status).toBe('실측필요');
    expect(f.source).toBe('manual');
    expect(r.summary.실측필요).toBeGreaterThan(0);
  });

  it('문자 높이 7.25mm 판정(보정 시)', () => {
    const cal = calibrationFromScreenSpec(screenSpec); // 0.18mm/px
    const screen: KioskScreen = {
      calibration: cal,
      elements: [
        { id: 'big', kind: 'text', charHeightPx: 50, boxPx: { x: 0, y: 0, widthPx: 200, heightPx: 50 }, fgColor: '#000', bgColor: '#fff' }, // 9mm ≥7.25
        { id: 'sml', kind: 'text', charHeightPx: 30, boxPx: { x: 0, y: 0, widthPx: 200, heightPx: 30 }, fgColor: '#000', bgColor: '#fff' }, // 5.4mm <7.25
      ],
    };
    const r = diagnoseKioskScreen(screen);
    expect(r.findings.find((f) => f.criterionId === 'kiosk.text.size' && f.elementId === 'big')?.status).toBe('적합');
    expect(r.findings.find((f) => f.criterionId === 'kiosk.text.size' && f.elementId === 'sml')?.status).toBe('부적합');
  });

  it('리포트: 우선순위(중요도)·수선분류·가드레일', () => {
    const screen: KioskScreen = {
      screenSpec,
      elements: [
        { id: 't', kind: 'text', boxPx: { x: 0, y: 0, widthPx: 100, heightPx: 20 }, fgColor: '#aaa', bgColor: '#fff' }, // 대비 부적합(critical)
        { id: 'b', kind: 'button', boxPx: { x: 0, y: 0, widthPx: 40, heightPx: 40 }, fgColor: '#fff', bgColor: '#1976d2' }, // MBR 부적합(critical, H/W) + 레이블(critical, S/W)
      ],
    };
    const r = diagnoseKioskScreen(screen);
    expect(r.priorities[0].importance).toBe('critical');
    expect(r.remedyBreakdown['H/W']).toBeGreaterThanOrEqual(1);
    expect(r.remedyBreakdown['S/W']).toBeGreaterThanOrEqual(1);
    expect(r.summary.passRateLabel).toMatch(/자동판정/);
    expect(r.guardrail).toMatch(/사람이 검수/);
  });
});
