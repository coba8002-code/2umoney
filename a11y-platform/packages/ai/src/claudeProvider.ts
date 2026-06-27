/**
 * C2: 실제 멀티모달 LLM(Claude) 프로바이더 — 이미지 내용을 보고 대체텍스트를 생성.
 * 공식 Anthropic SDK 사용. 색·레이아웃은 결정론 코드가 담당하고, 여기서는
 * 텍스트/판단 보조(대체텍스트, 문맥 평가)만 수행한다(스펙 7.3 경계).
 *
 * 기본 모델: claude-opus-4-8 (멀티모달). 샘플링 파라미터(temperature 등)는
 * 4.8 에서 제거되어 전달하지 않는다.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { A11yNode } from '@app/core';
import type { LlmProvider, ImageContext, AltSuggestion, AssessResult, Rule } from './provider';
import { HeuristicAltProvider } from './heuristicProvider';

export interface ClaudeProviderOptions {
  apiKey?: string;
  /** 기본 'claude-opus-4-8'. 비용/속도 위해 명시적으로만 교체. */
  model?: string;
  /** 테스트용 주입 (지정 시 apiKey 무시) */
  client?: Pick<Anthropic, 'messages'>;
}

const ALT_SYSTEM =
  '당신은 웹 접근성 전문가입니다. 이미지의 대체텍스트(alt)를 한국어로 작성합니다. ' +
  '핵심 정보만 간결하게(보통 80자 이내), 이미지 안의 글자는 그대로 포함하세요. ' +
  '정보 전달이 없는 순수 장식이면 isDecorative=true, alt="" 로 합니다. ' +
  'confidence 는 0~1 사이의 확신도입니다. ' +
  '반드시 JSON 객체만 출력: {"alt":string,"isDecorative":boolean,"confidence":number,"rationale":string}';

const ASSESS_SYSTEM =
  '웹 접근성 항목을 1차 평가합니다. 단정하지 말고 사람 검토를 전제로 판단하세요. ' +
  '반드시 JSON 만 출력: {"verdict":"pass"|"fail"|"unsure","rationale":string,"confidence":number}';

/** 'data:image/png;base64,XXXX' → {media_type, data} */
function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

/** 모델 응답 텍스트에서 첫 JSON 객체 추출 */
function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function firstText(res: Anthropic.Message): string {
  for (const block of res.content) {
    if (block.type === 'text') return block.text;
  }
  return '';
}

export class ClaudeAltProvider implements LlmProvider {
  private readonly client: Pick<Anthropic, 'messages'>;
  private readonly model: string;

  constructor(opts: ClaudeProviderOptions = {}) {
    this.client = opts.client ?? new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
    this.model = opts.model ?? 'claude-opus-4-8';
  }

  async suggestAltText(img: ImageContext): Promise<AltSuggestion> {
    const content: Anthropic.ContentBlockParam[] = [];
    if (img.dataUrl) {
      const parsed = parseDataUrl(img.dataUrl);
      if (parsed) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: parsed.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data: parsed.data,
          },
        });
      }
    }
    const ctx = [
      img.name ? `레이어/파일명: ${img.name}` : '',
      img.surroundingText ? `주변 텍스트: ${img.surroundingText}` : '',
      img.role ? `역할: ${img.role}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    content.push({ type: 'text', text: `다음 이미지의 대체텍스트를 작성하세요.\n${ctx}`.trim() });

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: ALT_SYSTEM,
      messages: [{ role: 'user', content }],
    });

    const json = extractJson(firstText(res));
    if (!json || typeof json.alt !== 'string') {
      return {
        alt: '',
        confidence: 0.1,
        isDecorative: false,
        rationale: 'AI 응답을 해석하지 못했습니다. 사람이 직접 작성하세요.',
      };
    }
    return {
      alt: String(json.alt),
      isDecorative: json.isDecorative === true,
      confidence: typeof json.confidence === 'number' ? json.confidence : 0.5,
      rationale: typeof json.rationale === 'string' ? json.rationale : 'AI 생성 — 사람 검토 권장.',
    };
  }

  async assessContextual(node: A11yNode, rule: Rule): Promise<AssessResult> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: ASSESS_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `항목: ${rule.criterion}\n대상: ${node.name ?? node.id} (${node.type})\n맥락 적절성을 1차 평가하세요.`,
        },
      ],
    });
    const json = extractJson(firstText(res));
    if (!json || typeof json.verdict !== 'string') {
      return { verdict: 'unsure', rationale: 'AI 응답 해석 실패 — 사람 확인 필요.', confidence: 0.1 };
    }
    const verdict = json.verdict === 'pass' || json.verdict === 'fail' ? json.verdict : 'unsure';
    return {
      verdict,
      rationale: typeof json.rationale === 'string' ? json.rationale : '',
      confidence: typeof json.confidence === 'number' ? json.confidence : 0.3,
    };
  }
}

/**
 * 환경에 따라 적절한 프로바이더를 선택한다.
 * API 키(또는 주입된 client)가 있으면 실제 멀티모달 Claude 프로바이더,
 * 없으면 네트워크 없이 동작하는 결정론 폴백(HeuristicAltProvider)을 반환한다.
 * AI 결과는 항상 ai-assisted 로 라벨링하고 사람이 수락 후 적용하는 것이 전제다(스펙 §5).
 */
export function createAltProvider(opts: ClaudeProviderOptions = {}): LlmProvider {
  const key = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (opts.client || key) {
    return new ClaudeAltProvider(opts);
  }
  return new HeuristicAltProvider();
}
