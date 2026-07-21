/**
 * G코드 파서 (RS-274 서브셋). 라인을 워드(letter+value) 배열로 토큰화한다.
 * 주석: 세미콜론(;) 이후, 괄호(...) 구간 제거.
 */

export interface GWord {
  letter: string; // 대문자 정규화 (G, M, X, Y, Z, I, J, R, F, S, N, T ...)
  value: number;
}

export interface GLine {
  n: number; // 1-based 소스 라인 번호
  raw: string;
  words: GWord[];
}

const WORD_RE = /([A-Za-z])\s*([+-]?(?:\d+\.?\d*|\.\d+))/g;

/** 괄호·세미콜론 주석 제거 */
export function stripComments(line: string): string {
  let out = '';
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '(') {
      depth++;
      continue;
    }
    if (c === ')') {
      if (depth > 0) depth--;
      continue;
    }
    if (c === ';') break; // 라인 나머지는 주석
    if (depth === 0) out += c;
  }
  return out;
}

export function tokenizeLine(line: string): GWord[] {
  const clean = stripComments(line);
  const words: GWord[] = [];
  for (const m of clean.matchAll(WORD_RE)) {
    words.push({ letter: m[1].toUpperCase(), value: Number(m[2]) });
  }
  return words;
}

export function parseProgram(text: string): GLine[] {
  const lines = text.split(/\r?\n/);
  const out: GLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const words = tokenizeLine(raw);
    if (words.length > 0) out.push({ n: i + 1, raw, words });
  }
  return out;
}

/** 워드 배열에서 특정 letter 의 값(첫 매치) 조회 */
export function wordValue(words: GWord[], letter: string): number | undefined {
  const w = words.find((x) => x.letter === letter);
  return w?.value;
}
