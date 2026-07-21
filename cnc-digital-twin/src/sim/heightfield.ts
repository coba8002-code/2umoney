/**
 * P3: 소재 하이트필드(Z-map) — 3축 밀링 절삭 시뮬용 2.5D 소재 모델.
 * XY 격자 각 셀에 "현재 표면 높이(z)"를 저장한다. 공구가 지나가면 표면을 낮춘다.
 */
export interface HeightfieldConfig {
  originX: number; // 격자 좌하단 X (mm)
  originY: number;
  nx: number; // X 셀 수
  ny: number; // Y 셀 수
  cellMm: number; // 셀 한 변(mm)
  topZ: number; // 소재 상단(초기 표면)
  bottomZ: number; // 소재 바닥(이 아래로는 못 깎음)
}

export interface Heightfield {
  cfg: HeightfieldConfig;
  z: Float64Array; // 길이 nx*ny, 인덱스 = iy*nx+ix
}

export function createHeightfield(cfg: HeightfieldConfig): Heightfield {
  const z = new Float64Array(cfg.nx * cfg.ny);
  z.fill(cfg.topZ);
  return { cfg, z };
}

/** 소재 경계를 감싸는 하이트필드를 만든다(여백 margin 포함). */
export function heightfieldForBounds(
  min: { x: number; y: number },
  max: { x: number; y: number },
  opts: { cellMm: number; topZ: number; bottomZ: number; marginMm?: number },
): Heightfield {
  const m = opts.marginMm ?? opts.cellMm * 2;
  const originX = min.x - m;
  const originY = min.y - m;
  const nx = Math.max(1, Math.ceil((max.x - min.x + 2 * m) / opts.cellMm));
  const ny = Math.max(1, Math.ceil((max.y - min.y + 2 * m) / opts.cellMm));
  return createHeightfield({ originX, originY, nx, ny, cellMm: opts.cellMm, topZ: opts.topZ, bottomZ: opts.bottomZ });
}

export function cellCenter(cfg: HeightfieldConfig, ix: number, iy: number): { x: number; y: number } {
  return {
    x: cfg.originX + (ix + 0.5) * cfg.cellMm,
    y: cfg.originY + (iy + 0.5) * cfg.cellMm,
  };
}

export function inBounds(cfg: HeightfieldConfig, ix: number, iy: number): boolean {
  return ix >= 0 && iy >= 0 && ix < cfg.nx && iy < cfg.ny;
}

export function getZ(hf: Heightfield, ix: number, iy: number): number {
  return hf.z[iy * hf.cfg.nx + ix];
}

/** 표면 통계(최저/최고). */
export function fieldStats(hf: Heightfield): { minZ: number; maxZ: number } {
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const v of hf.z) {
    if (v < minZ) minZ = v;
    if (v > maxZ) maxZ = v;
  }
  return { minZ, maxZ };
}
