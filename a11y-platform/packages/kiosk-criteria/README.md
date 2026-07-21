# @app/kiosk-criteria

JUX 배리어프리 키오스크 접근성 진단 플랫폼의 **기준 DB(단일 소스)**.
**별표5(무인정보단말기 접근성 검증 기준)** + **KS X 9211:2025(지침)** + **AI 항목·기술 매핑표(XLSX)** 를
기계가 읽는 `criteria.json` 으로 정형화한다.

> 표준 원문은 저작권(KATS·MOTIE)이 있어 요건은 **패러프레이즈 + 조항 인용**으로 인코딩한다.
> 임계값(12mm/144mm², 2.5mm, 4.5:1, 20초, 7.25mm, 초당 3회 등)은 사실 정보.

## 항목 스키마

각 기준(`KioskCriterion`)은 다음을 가진다:

| 필드 | 뜻 |
|---|---|
| `clause` | 근거 조항(별표5 / KS X 9211 / XLSX 원본행) |
| `category` | 손·팔 / 반응시간 / 시력 / 청력 / 인지 / 입출력 |
| `level` | `기본`(필수) / `해당시` |
| `modality` | 진단 담당: vision·ocr·speech·ui-flow·video·llm·measure |
| `a11yRuleId` | 기존 `@app/core` 룰 연결(대비·타깃크기 등) |
| `thresholds` | 구조화 임계값(mm·비율·초) |
| `source` | `auto` / `ai-assisted` / `manual` (가드레일: 항상 표기) |
| `needsMeasurement` | 이미지만으로 확정 불가 → 기준 마커/실측 필요 |

## 사용

```ts
import { criteria, criterionForA11yRule, criteriaByModality, coverage } from '@app/kiosk-criteria';

criterionForA11yRule('contrast.text');   // → kiosk.contrast (명도대비 4.5:1)
criteriaByModality('vision');            // 화면 비전으로 판정하는 기준들
coverage();                              // 엔진 연결/AI/수동 커버리지
```

## 진단 파이프라인에서의 위치

```
현장 이미지/영상/음성 → [모달리티별 진단(vision/ocr/speech/…)] → 이 DB 로 기준 매핑
   → 적합/부적합(+우수/보통) + 우선순위·수선분류 리포트
```

- 크기 계열(MBR·간격·문자높이)은 `@app/core` 의 **px→mm 보정**(`judgeMbr` 등)과 함께 사용한다.
- `needsMeasurement`·`source=manual` 항목은 자동 판정하지 않고 **실측/사람 검수**로 넘긴다.
