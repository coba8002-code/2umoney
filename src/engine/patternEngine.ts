/**
 * Pattern Recognition & Historical Returns Engine
 * Matches recent feature vectors against a historical library.
 */

export interface PatternFeatureVector {
  // Dimension 0: Daily Close / 20MA
  // Dimension 1: Daily RSI (Normalized 0 to 1)
  // Dimension 2: 3-day Return %
  // Dimension 3: Intraday Z-Score
  // Dimension N...
  vector: number[];
}

export interface HistoricalPattern {
  id: string;
  date: Date;
  features: PatternFeatureVector;
  
  // Known Future Outcomes recorded previously
  outcome3d: number; // Return after 3 days
  outcome5d: number;
  outcome10d: number;
  outcome20d: number;
  maxDrawdown10d: number; // Worst peak-to-trough within 10 days
}

export interface PatternAnalysisResult {
  similarPatternCount: number;
  winRate3d: number;     // 0 to 1
  winRate5d: number;
  winRate10d: number;
  avgReturn5d: number;
  avgReturn10d: number;
  avgMaxDrawdown10d: number;
  expectedReturn5d: number;
  expectedReturn10d: number;
  estimatedMaxDrawdown: number;
  reasoning: string[];
}

/**
 * Utility: Cosine Similarity between two N-dimensional vectors
 */
function cosineSimilarity(A: number[], B: number[]): number {
  if (A.length !== B.length || A.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * TODO: [Data Integration] Connect to historical K-line OHLCV database
 * Replace `historyDb` mock with continuous vector search (e.g., Pinecone or pgvector).
 * Main function: Analyzes matching past geometries to statistically predict future outcomes.
 */
export function analyzePatterns(
  currentFeature: PatternFeatureVector,
  historyDb: HistoricalPattern[],
  similarityThreshold: number = 0.90, // Cosine threshold
  topKLimit: number = 20              // Only take top N closest
): PatternAnalysisResult {
  
  // 1. Calculate similarity for all historical records
  const matches = historyDb.map(h => {
    return {
      record: h,
      similarity: cosineSimilarity(currentFeature.vector, h.features.vector)
    };
  });

  // 2. Filter by threshold and sort by highest similarity
  const validMatches = matches
    .filter(m => m.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topKLimit);

  const similarCount = validMatches.length;

  if (similarCount === 0) {
    return {
      similarPatternCount: 0,
      winRate3d: 0, winRate5d: 0, winRate10d: 0,
      avgReturn5d: 0, avgReturn10d: 0, avgMaxDrawdown10d: 0,
      expectedReturn5d: 0, expectedReturn10d: 0, estimatedMaxDrawdown: 0,
      reasoning: ["유사 과거 패턴을 찾을 수 없습니다. (데이터 부족 또는 특이 케이스)"]
    };
  }

  // 3. Aggregate Outcomes
  let wins3d = 0;
  let wins5d = 0;
  let wins10d = 0;
  
  let sumRet5d = 0;
  let sumRet10d = 0;
  let sumMdd = 0;

  validMatches.forEach(m => {
    const outcome = m.record;
    if (outcome.outcome3d > 0) wins3d++;
    if (outcome.outcome5d > 0) wins5d++;
    if (outcome.outcome10d > 0) wins10d++;

    // Calculate Expectancy Value sums (using similarity as a weight could be advanced, 
    // but here we do Simple Average)
    sumRet5d += outcome.outcome5d;
    sumRet10d += outcome.outcome10d;
    sumMdd += outcome.maxDrawdown10d;
  });

  const winRate3d = wins3d / similarCount;
  const winRate5d = wins5d / similarCount;
  const winRate10d = wins10d / similarCount;

  const avgReturn5d = sumRet5d / similarCount;
  const avgReturn10d = sumRet10d / similarCount;
  const avgMaxDrawdown10d = sumMdd / similarCount;

  const reasoning: string[] = [
    `최근 패턴과 ${similarityThreshold * 100}% 이상 유사한 과거 사례를 총 ${similarCount}개 발견했습니다.`,
    `5일 후 평균 승률: ${(winRate5d * 100).toFixed(1)}% / 평균 등락률: ${(avgReturn5d * 100).toFixed(2)}%`,
    `10일 연속 최대 하락폭 평균(MDD): ${(avgMaxDrawdown10d * 100).toFixed(2)}%`
  ];

  if (winRate5d > 0.65) reasoning.push(`단기(5일) 기대값이 통계적으로 강력합니다.`);
  if (avgMaxDrawdown10d < -0.05) reasoning.push(`주의: 유사 패턴 이후 평균적으로 -5% 이상의 강한 하락(흔들기)이 동반되었습니다.`);

  return {
    similarPatternCount: similarCount,
    winRate3d,
    winRate5d,
    winRate10d,
    avgReturn5d,
    avgReturn10d,
    avgMaxDrawdown10d,
    
    // In our simplified mock, "ExpectedReturn" = the average of the matched cases
    expectedReturn5d: avgReturn5d,
    expectedReturn10d: avgReturn10d, 
    estimatedMaxDrawdown: avgMaxDrawdown10d,
    
    reasoning
  };
}
