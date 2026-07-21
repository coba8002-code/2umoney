import { describe, it, expect } from 'vitest';
import { scanNodes } from '@app/core';
import { unityColorToHex, unityExportToA11yNodes, type UnityExport } from '../unityAdapter';

describe('unityAdapter — 색 변환', () => {
  it('hex 문자열을 그대로(소문자, # 보강)', () => {
    expect(unityColorToHex('#AABBCC')).toBe('#aabbcc');
    expect(unityColorToHex('aabbcc')).toBe('#aabbcc');
  });
  it('8자리 hex 는 알파 무시', () => {
    expect(unityColorToHex('#11223344')).toBe('#112233');
  });
  it('Unity Color(0~1 float)를 hex 로', () => {
    expect(unityColorToHex({ r: 1, g: 1, b: 1 })).toBe('#ffffff');
    expect(unityColorToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
  });
});

describe('unityAdapter — 정규화 + 결정론 룰셋 적용', () => {
  const sample: UnityExport = {
    screenBg: '#ffffff',
    root: {
      id: 'canvas',
      kind: 'Canvas',
      backgroundColor: '#ffffff',
      children: [
        // 대비 부족한 텍스트(연회색 on 흰색)
        { id: 'title', kind: 'TMP_Text', text: '주문하기', color: '#aaaaaa', fontSizePx: 18 },
        // 너무 작은 버튼(터치 타깃 미달) + 포커스 표시 없음
        {
          id: 'pay',
          kind: 'Button',
          backgroundColor: '#1976d2',
          rect: { width: 30, height: 28 },
          children: [{ id: 'paylabel', kind: 'Text', text: '결제', color: '#ffffff', fontSizePx: 16 }],
        },
        // 대체텍스트 없는 이미지
        { id: 'logo', kind: 'Image', rect: { width: 120, height: 40 } },
      ],
    },
  };

  it('Canvas→container, Text→text, Button→button, Image→image 로 매핑', () => {
    const [root] = unityExportToA11yNodes(sample);
    expect(root.type).toBe('container');
    const kinds = (root.children ?? []).map((c) => c.type);
    expect(kinds).toEqual(['text', 'button', 'image']);
  });

  it('대비 미달 텍스트를 contrast.text fail 로 잡는다', () => {
    const nodes = unityExportToA11yNodes(sample);
    const { findings } = scanNodes(nodes);
    const c = findings.find((f) => f.ruleId === 'contrast.text' && f.nodeId === 'title');
    expect(c?.status).toBe('fail');
  });

  it('작은 버튼을 target.size fail 로 잡는다 (키오스크 핵심)', () => {
    const nodes = unityExportToA11yNodes(sample);
    const { findings } = scanNodes(nodes);
    const t = findings.find((f) => f.ruleId === 'target.size' && f.nodeId === 'pay');
    expect(t?.status).toBe('fail');
  });

  it('alt 없는 이미지를 img.alt fail, 라벨 있으면 통과', () => {
    const failFindings = scanNodes(unityExportToA11yNodes(sample)).findings;
    expect(failFindings.find((f) => f.ruleId === 'img.alt' && f.nodeId === 'logo')?.status).toBe('fail');

    const withAlt: UnityExport = {
      root: { id: 'img', kind: 'Image', accessibilityLabel: '브랜드 로고', rect: { width: 120, height: 40 } },
    };
    const passFindings = scanNodes(unityExportToA11yNodes(withAlt)).findings;
    expect(passFindings.find((f) => f.ruleId === 'img.alt')?.status).toBe('pass');
  });

  it('interactable=true 면 비표준 kind 도 포커스 대상으로 본다', () => {
    const [n] = unityExportToA11yNodes({ root: { id: 'x', kind: 'CustomWidget', interactable: true, text: '메뉴' } });
    expect(n.focusable).toBe(true);
    expect(n.label).toBe('메뉴');
  });

  it('배열/단일 노드 입력도 허용', () => {
    expect(unityExportToA11yNodes([{ id: 'a', kind: 'Text', text: 'x' }])).toHaveLength(1);
    expect(unityExportToA11yNodes({ id: 'b', kind: 'Image' })[0].type).toBe('image');
  });

  it('C# 스크립트 출력 형식({nodes:[...]})을 그대로 처리', () => {
    // examples/unity/A11yUnityExporter.cs 가 내보내는 구조
    const scriptOutput: UnityExport = {
      screenBg: '#ffffff',
      nodes: [
        {
          id: 'Canvas',
          name: 'Canvas',
          kind: 'Canvas',
          backgroundColor: '#ffffff',
          children: [
            { id: 'Canvas/Title', name: 'Title', kind: 'TMP_Text', text: '주문', color: '#222222', fontSizePx: 40, fontStyle: 'Bold' },
            { id: 'Canvas/Small', name: 'Small', kind: 'Button', backgroundColor: '#cccccc', interactable: true, hasFocusVisual: false, rect: { width: 28, height: 28 } },
          ],
        },
      ],
    };
    const nodes = unityExportToA11yNodes(scriptOutput);
    expect(nodes[0].type).toBe('container');
    const title = nodes[0].children![0];
    expect(title.type).toBe('text');
    expect(title.bold).toBe(true); // fontStyle:'Bold' → bold
    const { findings } = scanNodes(nodes);
    // 큰 폰트·충분한 대비 제목은 통과, 작은 버튼은 타깃 크기 실패
    expect(findings.find((f) => f.ruleId === 'target.size' && f.nodeId === 'Canvas/Small')?.status).toBe('fail');
  });
});
