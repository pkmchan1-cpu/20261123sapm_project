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
    // 이미지 base64 포함 시 용량이 커질 수 있으므로 7MB로 상향
    const MAX_BYTES = 7 * 1024 * 1024;

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

// 판매글 및 사진을 받아 사기 위험도를 분석하는 핵심 API 핸들러입니다.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendError(res, 'METHOD_NOT_ALLOWED');
    }

    if (!process.env.OPENAI_API_KEY) {
      return sendError(res, 'SERVER_CONFIG');
    }

    const bodyResult = await readJsonBody(req);
    if (!bodyResult.ok || !bodyResult.data || typeof bodyResult.data !== 'object') {
      return sendError(res, 'INVALID_REQUEST');
    }

    const { text, image } = bodyResult.data;
    if (typeof text !== 'string') {
      return sendError(res, 'INVALID_REQUEST');
    }

    const trimmed = text.trim();

    if (trimmed.length === 0) {
      return sendError(res, 'EMPTY_INPUT');
    }

    if (trimmed.length < 10) {
      return sendError(res, 'TOO_SHORT');
    }

    if (trimmed.length > 2000) {
      return sendError(res, 'TOO_LONG');
    }

    const maskedText = maskPersonalInfo(trimmed);

    // OpenAI 클라이언트 초기화
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: Number(process.env.AI_TIMEOUT_MS) || 15000,
      maxRetries: 0,
    });

    // 메시지 구성 (이미지가 있는 경우 Vision 멀티모달 포맷 적용)
    let userContent;
    if (typeof image === 'string' && image.startsWith('data:image/')) {
      userContent = [
        { type: 'text', text: buildUserMessage(maskedText) },
        {
          type: 'image_url',
          image_url: {
            url: image,
            detail: 'low', // 토큰 및 비용 절감
          },
        },
      ];
    } else {
      userContent = buildUserMessage(maskedText);
    }

    let completion;
    try {
      completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
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

    const validated = validateAndSanitizeAiResponse(content);
    if (!validated.valid) {
      return sendError(res, 'INVALID_AI_RESPONSE');
    }

    if (!validated.isTradePost) {
      return sendError(res, 'NOT_TRADE_POST');
    }

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
