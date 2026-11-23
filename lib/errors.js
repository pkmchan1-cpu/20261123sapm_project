// 오류 코드별 HTTP 상태코드와 메시지를 한곳에 모아둔 표 (서버용)
export const ERRORS = {
  EMPTY_INPUT:         { status: 400, message: '판매글을 붙여넣어 주세요.' },
  TOO_SHORT:           { status: 400, message: '판매글이 너무 짧아요. 제목과 본문을 함께 10자 이상 붙여넣어 주세요.' },
  TOO_LONG:            { status: 400, message: '판매글이 너무 길어요. 2,000자 이하로 줄여서 다시 시도해 주세요.' },
  INVALID_REQUEST:     { status: 400, message: '요청 형식이 올바르지 않아요. 페이지를 새로고침한 뒤 다시 시도해 주세요.' },
  METHOD_NOT_ALLOWED:  { status: 405, message: '지원하지 않는 요청 방식이에요.' },
  NOT_TRADE_POST:      { status: 422, message: '중고거래 판매글이 아닌 것 같아요. 판매글의 제목과 본문을 그대로 붙여넣어 주세요.' },
  AI_TIMEOUT:          { status: 504, message: '분석 시간이 너무 오래 걸렸어요. 잠시 후 다시 시도해 주세요.' },
  AI_RATE_LIMIT:       { status: 429, message: '지금 요청이 많아 분석이 어려워요. 1분 정도 뒤에 다시 시도해 주세요.' },
  AI_QUOTA:            { status: 503, message: '서비스 사용량이 한도에 도달했어요. 관리자에게 문의해 주세요.' },
  AI_ERROR:            { status: 502, message: 'AI 분석 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' },
  INVALID_AI_RESPONSE: { status: 502, message: '분석 결과를 읽지 못했어요. 다시 시도해 주세요.' },
  SERVER_CONFIG:       { status: 500, message: '서비스 설정에 문제가 있어요. 관리자에게 문의해 주세요.' },
};

// 실패 응답을 보내는 함수: { ok: false, error: { code, message } }
export function sendError(res, code) {
  const err = ERRORS[code] || ERRORS.AI_ERROR;
  const actualCode = ERRORS[code] ? code : 'AI_ERROR';

  if (actualCode === 'METHOD_NOT_ALLOWED') {
    res.setHeader('Allow', 'POST');
  }

  res.statusCode = err.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    ok: false,
    error: {
      code: actualCode,
      message: err.message,
    },
  }));
}
