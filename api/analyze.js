import OpenAI from 'openai';
import { maskPersonalInfo } from '../lib/mask.js';
import { SYSTEM_PROMPT, ANALYSIS_SCHEMA, buildUserMessage } from '../lib/prompt.js';
import { validateAndSanitizeAiResponse } from '../lib/validate.js';
import { sendError } from '../lib/errors.js';

// Vercel 및 로컬 환경에서 HTTP 요청 본문(JSON)을 안전하게 읽어오는 함수입니다.
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return { ok: true, data: req.body };
  }
  if (req.body && typeof req.body === 'string') {
    try {
      return { ok: true, data: JSON.parse(req.body) };
    } catch {
      return { ok: false };
    }
  }

  return new Promise((resolve) => {
    let bodyStr = '';
    let bytesRead = 0;
    const MAX_BYTES = 10240; // 10KB 초과 방지

    req.on('data', (chunk) => {
      bytesRead += chunk.length;
      if (bytesRead > MAX_BYTES) {
        req.destroy();
        resolve({ ok: false });
        return;
      }
      bodyStr += chunk;
    });

    req.on('end', () => {
      try {
        const parsed = JSON.parse(bodyStr);
        resolve({ ok: true, data: parsed });
      } catch {
        resolve({ ok: false });
      }
    });

    req.on('error', () => {
      resolve({ ok: false });
    });
  });
}

// 판매글을 받아 사기 위험도를 분석하는 핵심 API 핸들러입니다.
export default async function handler(req, res) {
  try {
    // 1. POST 메서드 검사
    if (req.method !== 'POST') {
      return sendError(res, 'METHOD_NOT_ALLOWED');
    }

    // 2. OpenAI API 키 설정 여부 확인
    if (!process.env.OPENAI_API_KEY) {
      return sendError(res, 'SERVER_CONFIG');
    }

    // 3. 요청 본문 읽기 및 JSON 파싱
    const bodyResult = await readJsonBody(req);
    if (!bodyResult.ok || !bodyResult.data || typeof bodyResult.data !== 'object') {
      return sendError(res, 'INVALID_REQUEST');
    }

    // 4. body.text 문자열 확인
    const { text } = bodyResult.data;
    if (typeof text !== 'string') {
      return sendError(res, 'INVALID_REQUEST');
    }

    const trimmed = text.trim();

    // 5. 빈 입력 검사
    if (trimmed.length === 0) {
      return sendError(res, 'EMPTY_INPUT');
    }

    // 6. 최소 길이 (10자) 검사
    if (trimmed.length < 10) {
      return sendError(res, 'TOO_SHORT');
    }

    // 7. 최대 길이 (2,000자) 검사
    if (trimmed.length > 2000) {
      return sendError(res, 'TOO_LONG');
    }

    // 8. 개인정보 가리기
    const maskedText = maskPersonalInfo(trimmed);

    // 9. OpenAI 호출
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: Number(process.env.AI_TIMEOUT_MS) || 15000,
      maxRetries: 0,
    });

    let completion;
    try {
      completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(maskedText) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'fraud_analysis', strict: true, schema: ANALYSIS_SCHEMA },
        },
        max_completion_tokens: 600,
      });
    } catch (err) {
      if (err instanceof OpenAI.APIConnectionTimeoutError) {
        console.error('[analyze]', 'AI_TIMEOUT', err.status ?? '', err.message);
        return sendError(res, 'AI_TIMEOUT');
      }
      if (err.status === 429 && err.code === 'insufficient_quota') {
        console.error('[analyze]', 'AI_QUOTA', err.status ?? '', err.message);
        return sendError(res, 'AI_QUOTA');
      }
      if (err.status === 429) {
        console.error('[analyze]', 'AI_RATE_LIMIT', err.status ?? '', err.message);
        return sendError(res, 'AI_RATE_LIMIT');
      }
      if (err.status === 401) {
        console.error('[analyze]', 'SERVER_CONFIG', err.status ?? '', err.message);
        return sendError(res, 'SERVER_CONFIG');
      }

      console.error('[analyze]', 'AI_ERROR', err.status ?? '', err.message);
      return sendError(res, 'AI_ERROR');
    }

    const choice = completion.choices?.[0];
    const content = choice?.message?.content;

    if (choice?.finish_reason === 'length' || !content) {
      return sendError(res, 'INVALID_AI_RESPONSE');
    }

    // 10. AI 응답 검사 및 정제
    const validated = validateAndSanitizeAiResponse(content);
    if (!validated.valid) {
      return sendError(res, 'INVALID_AI_RESPONSE');
    }

    // 11. 판매글 아님 판별
    if (!validated.isTradePost) {
      return sendError(res, 'NOT_TRADE_POST');
    }

    // 12. 성공 응답 반환
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: true,
      data: validated.data,
    }));
  } catch (err) {
    console.error('[analyze]', 'AI_ERROR', '', err?.message || 'Unexpected server error');
    return sendError(res, 'AI_ERROR');
  }
}
