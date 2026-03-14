import { analyzeNews, NewsEngineInput, NewsTag } from './newsEngine';

describe('News Analysis Engine', () => {

  const baseInput: NewsEngineInput = {
    currencyCode: 'USD',
    strategyGroup: 'A',
    recentArticles: [],
    eventProximityHours: null
  };

  test('Gracefully handles zero news with neutral scores', () => {
    const result = analyzeNews(baseInput);
    expect(result.sentimentScore).toBe(0);
    expect(result.summaryText).toContain('최근 확보된 주요 뉴스');
    expect(result.newsVolumeSpike).toBe(false);
  });

  test('Captures sentiment on RATE_HIKE & INFLATION_HOT properly', () => {
    const result = analyzeNews({
      ...baseInput,
      recentArticles: [
        { headline: "Fed hikes rates by 25bps", sourceBias: 0.1, detectedTags: [NewsTag.RATE_HIKE], publishedHoursAgo: 2 },
        { headline: "Inflation hits 4% surprisingly", sourceBias: 0.2, detectedTags: [NewsTag.INFLATION_HOT], publishedHoursAgo: 5 }
      ]
    });

    expect(result.sentimentScore).toBeGreaterThan(0); // 0.5 + 0.3 = positive
    expect(result.policyRiskScore).toBeGreaterThan(0); // 2 + 0
    expect(result.uncertaintyScore).toBeGreaterThan(0); // 0 + 1
    expect(result.dominantTags).toContain(NewsTag.RATE_HIKE);
  });

  test('Penalizes Group A Safe Havens for positive headlines but boosts heavily on fear', () => {
    const resultFear = analyzeNews({
       currencyCode: 'CHF',
       strategyGroup: 'A',
       recentArticles: [
          { headline: "War erupts", sourceBias: 0, detectedTags: [NewsTag.WAR_RISK], publishedHoursAgo: 1 },
          { headline: "Economic collapse feared", sourceBias: 0, detectedTags: [NewsTag.RECESSION_FEAR], publishedHoursAgo: 2 }
       ],
       eventProximityHours: null
    });

    // In 'A' group: WAR_RISK = +0.7 totalSentiment, REC_FEAR = -0.6 + 0.8 = +0.2 -> Positives!
    expect(resultFear.sentimentScore).toBeGreaterThan(0.3);
    expect(resultFear.uncertaintyScore).toBeGreaterThan(3);
  });

  test('Calculates Event Proximity aggressively', () => {
    const result = analyzeNews({
       ...baseInput,
       eventProximityHours: 12 // 12 hours away
    });
    // Max 10. formula: 10 - 12/4.8 = 7.5
    expect(result.eventProximityScore).toBe(7.5);
  });
  
  test('Correctly identifies Volume Spikes', () => {
      const result = analyzeNews({
         ...baseInput,
         recentArticles: Array(6).fill({ headline: "Blah", sourceBias: 0, detectedTags: [NewsTag.STIMULUS], publishedHoursAgo: 1 })
      });
      // 6 > 5 threshold
      expect(result.newsVolumeSpike).toBe(true);
      expect(result.summaryText).toContain('트래픽 집중');
    });

});
