// AI 응답 내용이 규격에 맞는지 꼼꼼하게 검사하고 다듬어주는 함수입니다.
export function validateAndSanitizeAiResponse(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { valid: false };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return { valid: false };
  }

  // 필수 불리언 확인
  if (typeof parsed.isTradePost !== 'boolean') {
    return { valid: false };
  }

  // 판매글이 아닐 경우
  if (!parsed.isTradePost) {
    return { valid: true, isTradePost: false };
  }

  // riskLevel 검사
  const validRisks = ['danger', 'caution', 'safe'];
  if (!validRisks.includes(parsed.riskLevel)) {
    return { valid: false };
  }

  // confidence 검사 및 정제 (0~100 정수)
  if (typeof parsed.confidence !== 'number' || isNaN(parsed.confidence)) {
    return { valid: false };
  }
  let confidence = Math.round(parsed.confidence);
  if (confidence < 0) confidence = 0;
  if (confidence > 100) confidence = 100;

  // reason 검사 및 정제 (1~200자)
  if (typeof parsed.reason !== 'string' || !parsed.reason.trim()) {
    return { valid: false };
  }
  let reason = parsed.reason.trim();
  if (reason.length > 200) {
    reason = reason.slice(0, 199) + '…';
  }

  // signals 검사 및 정제
  let signals = [];
  if (Array.isArray(parsed.signals)) {
    for (const item of parsed.signals) {
      if (!item || typeof item !== 'object') continue;
      if (typeof item.label !== 'string' || !item.label.trim()) continue;
      if (typeof item.evidence !== 'string') continue;
      if (!['high', 'medium', 'low'].includes(item.severity)) continue;

      let label = item.label.trim();
      if (label.length > 20) label = label.slice(0, 19) + '…';

      let evidence = item.evidence.trim();
      if (evidence.length > 60) evidence = evidence.slice(0, 59) + '…';

      signals.push({
        label,
        evidence,
        severity: item.severity,
      });
    }
  }

  // signals 최대 5개 유지
  if (signals.length > 5) {
    signals = signals.slice(0, 5);
  }

  return {
    valid: true,
    isTradePost: true,
    data: {
      riskLevel: parsed.riskLevel,
      confidence,
      reason,
      signals,
    },
  };
}
