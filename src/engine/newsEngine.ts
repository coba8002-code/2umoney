/**
 * News Sentiment & Event Risk Engine
 * Mock implementation to be connected to GDELT or News API later.
 */

export enum NewsTag {
  RATE_HIKE = 'RATE_HIKE',
  RATE_CUT = 'RATE_CUT',
  INTERVENTION = 'INTERVENTION',
  INFLATION_HOT = 'INFLATION_HOT',
  INFLATION_COOL = 'INFLATION_COOL',
  RECESSION_FEAR = 'RECESSION_FEAR',
  TRADE_TENSION = 'TRADE_TENSION',
  WAR_RISK = 'WAR_RISK',
  STIMULUS = 'STIMULUS',
  CAPITAL_OUTFLOW = 'CAPITAL_OUTFLOW',
  TOURISM_RECOVERY = 'TOURISM_RECOVERY',
  NEUTRAL = 'NEUTRAL'
}

export interface RawArticleFeature {
  headline: string;
  sourceBias: number; // 0 (neutral) to 1 (highly biased/sensational)
  detectedTags: NewsTag[];
  publishedHoursAgo: number;
}

export interface NewsEngineInput {
  currencyCode: string;
  strategyGroup: 'A' | 'B' | 'C' | 'D';
  // Mock external data
  recentArticles: RawArticleFeature[];
  eventProximityHours: number | null; // e.g. CPI release in 12 hours
}

export interface NewsEngineResult {
  sentimentScore: number;       // -1.0 to 1.0
  newsVolumeSpike: boolean;     // e.g. Is there a flood of news right now?
  policyRiskScore: number;      // 0 to 10
  uncertaintyScore: number;     // 0 to 10 (Conflict in news direction)
  eventProximityScore: number;  // 0 to 10 (Closer = Higher)
  summaryText: string;
  dominantTags: NewsTag[];
}

/**
 * TODO: [Data Integration] Connect to GDELT or News API here
 * Map real-time articles to RawArticleFeature interface.
 * Mocks the NLP parsing and aggregates articles into actionable scores
 */
export function analyzeNews(input: NewsEngineInput): NewsEngineResult {
  let totalSentiment = 0;
  let policyRiskTotal = 0;
  let uncertaintyTotal = 0;
  const tagCounts: Record<string, number> = {};

  // If no news, return neutral mock
  if (input.recentArticles.length === 0) {
     return {
       sentimentScore: 0,
       newsVolumeSpike: false,
       policyRiskScore: 0,
       uncertaintyScore: 0,
       eventProximityScore: input.eventProximityHours ? Math.max(0, 10 - (input.eventProximityHours / 4.8)) : 0,
       summaryText: `[${input.currencyCode}] 최근 확보된 주요 뉴스가 없습니다. 매크로 캘린더에 의존합니다.`,
       dominantTags: [NewsTag.NEUTRAL]
     };
  }

  input.recentArticles.forEach(article => {
    // 1. Tag Scoring
    article.detectedTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;

      // Base Tag Weights (Simplified rules)
      switch (tag) {
        case NewsTag.RATE_HIKE:
          totalSentiment += 0.5;
          policyRiskTotal += 2;
          break;
        case NewsTag.RATE_CUT:
          totalSentiment -= 0.5;
          policyRiskTotal += 2;
          break;
        case NewsTag.INFLATION_HOT:
          totalSentiment += 0.3; // Often implies rate hikes = currency strong
          uncertaintyTotal += 1;
          break;
        case NewsTag.INFLATION_COOL:
          totalSentiment -= 0.3;
          break;
        case NewsTag.INTERVENTION:
          totalSentiment += 0.8; // Interventions usually prop up the currency
          policyRiskTotal += 5;
          uncertaintyTotal += 4;
          break;
        case NewsTag.RECESSION_FEAR:
          totalSentiment -= 0.6;
          uncertaintyTotal += 3;
          if (input.strategyGroup === 'A') totalSentiment += 0.8; // Safe Havens benefit
          break;
        case NewsTag.WAR_RISK:
          uncertaintyTotal += 5;
          if (input.strategyGroup === 'A' && input.currencyCode !== 'GBP') totalSentiment += 0.7; // Flight to safety
          else totalSentiment -= 0.8; 
          break;
        case NewsTag.TRADE_TENSION:
          uncertaintyTotal += 3;
          policyRiskTotal += 2;
          if (input.strategyGroup === 'C' || input.strategyGroup === 'B') totalSentiment -= 0.5; // China/Aussie hurt
          break;
        case NewsTag.CAPITAL_OUTFLOW:
          totalSentiment -= 0.9;
          policyRiskTotal += 3;
          break;
        case NewsTag.STIMULUS:
        case NewsTag.TOURISM_RECOVERY:
          totalSentiment += 0.4;
          break;
      }
    });
  });

  // Calculate Averages & Bounds
  const numArticles = input.recentArticles.length;
  const newsVolumeSpike = numArticles >= 5; // e.g. threshold of 5

  let sentimentScore = Math.max(-1.0, Math.min(1.0, totalSentiment / numArticles));
  let policyRiskScore = Math.max(0, Math.min(10, policyRiskTotal / numArticles));
  let uncertaintyScore = Math.max(0, Math.min(10, uncertaintyTotal / numArticles));

  // Determine Event Proximity Score
  let eventProximityScore = 0;
  if (input.eventProximityHours !== null) {
      // e.g., <= 48 hours = impact
      // 0 hours = 10 score, 48 hours = 0 score
      eventProximityScore = Math.max(0, Math.min(10, 10 - (input.eventProximityHours / 4.8)));
  }

  // Find dominant tags
  const dominantTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1]) // highest count first
      .slice(0, 3)                 // top 3
      .map(entry => entry[0] as NewsTag);

  // Generate Summary Text based on outputs
  let summaryText = `[${input.currencyCode}] `;
  if (newsVolumeSpike) summaryText += `단기 뉴스 트래픽 집중. `;
  
  if (policyRiskScore > 7) {
    summaryText += `정책 개입/변경 리스크가 매우 크며 (${policyRiskScore.toFixed(1)}/10), `;
  } else if (uncertaintyScore > 6) {
    summaryText += `시장 해석이 엇갈리며 불확실성이 높습니다 (${uncertaintyScore.toFixed(1)}/10). `;
  }

  if (sentimentScore > 0.5) {
    summaryText += `뉴스 센티먼트는 강력한 호조(${sentimentScore.toFixed(2)})를 보이고 있습니다.`;
  } else if (sentimentScore < -0.5) {
    summaryText += `뉴스 센티먼트는 뚜렷한 악재(${sentimentScore.toFixed(2)})를 반영 중입니다.`;
  } else {
    summaryText += `뉴스 센티먼트는 중립적(${sentimentScore.toFixed(2)})입니다.`;
  }

  return {
    sentimentScore,
    newsVolumeSpike,
    policyRiskScore,
    uncertaintyScore,
    eventProximityScore,
    summaryText,
    dominantTags
  };
}
