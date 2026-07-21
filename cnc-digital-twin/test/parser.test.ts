import { describe, it, expect } from 'vitest';
import { parseProgram, stripComments, tokenizeLine, wordValue } from '../src/gcode/parser';

describe('G코드 파서', () => {
  it('괄호·세미콜론 주석 제거', () => {
    expect(stripComments('G1 X10 (급속 아님) Y20 ; 이건 주석').trim()).toBe('G1 X10  Y20');
  });

  it('워드 토큰화(대문자 정규화, 소수·부호)', () => {
    const w = tokenizeLine('g1 x-1.5 y.5 f100');
    expect(w).toEqual([
      { letter: 'G', value: 1 },
      { letter: 'X', value: -1.5 },
      { letter: 'Y', value: 0.5 },
      { letter: 'F', value: 100 },
    ]);
  });

  it('빈 줄/주석 전용 줄은 프로그램에서 제외', () => {
    const p = parseProgram('G21\n; comment only\n\nG0 X0');
    expect(p.map((l) => l.n)).toEqual([1, 4]);
  });

  it('wordValue 조회', () => {
    const w = tokenizeLine('G2 X10 Y0 I5 J0');
    expect(wordValue(w, 'I')).toBe(5);
    expect(wordValue(w, 'Z')).toBeUndefined();
  });
});
