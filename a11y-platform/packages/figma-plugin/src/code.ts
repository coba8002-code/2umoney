/// <reference types="@figma/plugin-typings" />
import { scanNodes, type Finding } from '@app/core';
import { collectRoots, hexToPaintRgb } from './adapter';
import type { UiToMain, MainToUi } from './messages';

figma.showUI(__html__, { width: 420, height: 640, themeColors: true });

let lastFindings: Finding[] = [];

function post(msg: MainToUi): void {
  figma.ui.postMessage(msg);
}

async function runScan(scope: 'selection' | 'page'): Promise<void> {
  try {
    const roots = collectRoots(scope);
    const result = scanNodes(roots);
    lastFindings = result.findings;
    post({ type: 'scan-result', result, scope });
  } catch (e) {
    post({ type: 'error', message: `스캔 실패: ${(e as Error).message}` });
  }
}

/** 색 보정: 가능하면 같은 색의 Variable 로 바인딩, 아니면 직접 fills 치환 */
async function applyColorFix(node: SceneNode, hex: string): Promise<void> {
  if (!('fills' in node)) throw new Error('이 노드는 색을 가질 수 없습니다.');
  const rgb = hexToPaintRgb(hex);
  const paint: SolidPaint = { type: 'SOLID', color: rgb, opacity: 1 };

  // Variables(디자인 토큰) 우선: 동일 색의 COLOR 변수가 있으면 바인딩
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    for (const col of collections) {
      for (const id of col.variableIds) {
        const v = await figma.variables.getVariableByIdAsync(id);
        if (!v || v.resolvedType !== 'COLOR') continue;
        const modeId = col.defaultModeId;
        const val = v.valuesByMode[modeId] as RGB | RGBA | undefined;
        if (val && 'r' in val && approxEq(val.r, rgb.r) && approxEq(val.g, rgb.g) && approxEq(val.b, rgb.b)) {
          const bound = figma.variables.setBoundVariableForPaint(paint, 'color', v);
          (node as GeometryMixin).fills = [bound];
          return;
        }
      }
    }
  } catch {
    // variables API 미지원/오류 시 직접 치환으로 폴백
  }
  (node as GeometryMixin).fills = [paint];
}

function approxEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.004; // ~1/255
}

async function applyFix(nodeId: string, ruleId: string): Promise<void> {
  const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
  const finding = lastFindings.find((f) => f.nodeId === nodeId && f.ruleId === ruleId);
  if (!node || !finding || !finding.fix) {
    post({ type: 'applied', nodeId, ruleId, ok: false, message: '대상 또는 보정 정보를 찾을 수 없습니다.' });
    return;
  }
  try {
    const fix = finding.fix;
    switch (fix.kind) {
      case 'color':
        await applyColorFix(node, fix.after.fgColor as string);
        break;
      case 'touchTarget': {
        if (!('resize' in node)) throw new Error('크기 변경 불가 노드');
        const w = fix.after.width as number;
        const h = fix.after.height as number;
        (node as LayoutMixin).resize(w, h);
        break;
      }
      case 'fontSize': {
        if (node.type !== 'TEXT') throw new Error('텍스트가 아닙니다.');
        await figma.loadFontAsync(node.fontName as FontName);
        node.fontSize = fix.after.fontSizePx as number;
        break;
      }
      case 'focusStyle':
      case 'altText':
      case 'aria':
        // Figma 단계에서는 직접 적용 불가(코드/AI 단계) → 안내만
        post({
          type: 'applied',
          nodeId,
          ruleId,
          ok: false,
          message: `이 항목(${fix.kind})은 개발/AI 단계에서 적용됩니다. (Phase 2)`,
        });
        return;
    }
    post({ type: 'applied', nodeId, ruleId, ok: true, message: '보정을 적용했습니다.' });
    await runScan('selection'); // 재스캔으로 합격 확인
  } catch (e) {
    post({ type: 'applied', nodeId, ruleId, ok: false, message: `적용 실패: ${(e as Error).message}` });
  }
}

async function applyAllColor(): Promise<void> {
  const colorFails = lastFindings.filter((f) => f.status === 'fail' && f.fix?.kind === 'color');
  for (const f of colorFails) {
    const node = (await figma.getNodeByIdAsync(f.nodeId)) as SceneNode | null;
    if (node && f.fix) {
      try {
        await applyColorFix(node, f.fix.after.fgColor as string);
      } catch {
        /* 개별 실패는 건너뜀 */
      }
    }
  }
  figma.notify(`${colorFails.length}개 색대비 항목을 보정했습니다.`);
  await runScan('selection');
}

async function highlight(nodeId: string): Promise<void> {
  const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
  if (!node) return;
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}

figma.ui.onmessage = async (msg: UiToMain) => {
  switch (msg.type) {
    case 'scan':
      await runScan(msg.scope);
      break;
    case 'apply-fix':
      await applyFix(msg.nodeId, msg.ruleId);
      break;
    case 'apply-all-color':
      await applyAllColor();
      break;
    case 'highlight':
      await highlight(msg.nodeId);
      break;
    case 'resize':
      figma.ui.resize(Math.max(360, msg.width), Math.max(480, msg.height));
      break;
  }
};

// 최초 진입 시 선택 영역 자동 스캔
runScan('selection');
