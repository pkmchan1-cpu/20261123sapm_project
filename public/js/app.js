// 화면 동작과 사용자 인터랙션을 제어하는 메인 스크립트입니다.
import { SAMPLE_POSTS, TIPS, ERROR_MESSAGES, RETRYABLE_CODES, LIMITS } from './constants.js';

// DOM 요소 참조
const postInput = document.getElementById('post-input');
const charCount = document.getElementById('char-count');
const sampleBtns = document.querySelectorAll('.sample-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const resetBtn = document.getElementById('reset-btn');

const loading = document.getElementById('loading');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');

const resultSection = document.getElementById('result-section');
const riskBadge = document.getElementById('risk-badge');
const confidenceValue = document.getElementById('confidence-value');
const confidenceBar = document.getElementById('confidence-bar');
const confidenceFill = document.getElementById('confidence-fill');
const reasonText = document.getElementById('reason-text');
const signalCount = document.getElementById('signal-count');
const signalList = document.getElementById('signal-list');
const noSignal = document.getElementById('no-signal');
const tipsList = document.getElementById('tips-list');

// 분석 진행 중 여부
let isLoading = false;

// 1. 처음 상태 (idle)
function showIdle() {
  postInput.disabled = false;
  sampleBtns.forEach((btn) => (btn.disabled = false));
  resetBtn.disabled = false;
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = '분석하기';

  loading.hidden = true;
  errorSection.hidden = true;
  resultSection.hidden = true;
}

// 2. 분석 중 상태 (loading)
function showLoading() {
  postInput.disabled = true;
  sampleBtns.forEach((btn) => (btn.disabled = true));
  resetBtn.disabled = true;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '분석 중...';

  loading.hidden = false;
  errorSection.hidden = true;
  resultSection.hidden = true;
}

// 3. 결과 표시 상태 (success)
function showResult(data) {
  postInput.disabled = false;
  sampleBtns.forEach((btn) => (btn.disabled = false));
  resetBtn.disabled = false;
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = '분석하기';

  loading.hidden = true;
  errorSection.hidden = true;
  resultSection.hidden = false;

  // 배지 설정 (위험, 주의, 안전)
  riskBadge.className = '';
  riskBadge.classList.add(`badge--${data.riskLevel}`);
  if (data.riskLevel === 'danger') {
    riskBadge.textContent = '🚨 위험';
  } else if (data.riskLevel === 'caution') {
    riskBadge.textContent = '⚠️ 주의';
  } else {
    riskBadge.textContent = '✅ 안전';
  }

  // 신뢰도 막대 및 수치 설정
  confidenceValue.textContent = `${data.confidence}%`;
  confidenceBar.setAttribute('aria-valuenow', String(data.confidence));
  confidenceFill.style.width = `${data.confidence}%`;
  confidenceFill.className = '';
  confidenceFill.classList.add(`fill--${data.riskLevel}`);

  // 분석 이유
  reasonText.textContent = data.reason;

  // 위험 신호 목록 (높음 → 보통 → 낮음 순 정렬)
  const severityOrder = { high: 1, medium: 2, low: 3 };
  const sortedSignals = [...(data.signals || [])].sort((a, b) => {
    return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
  });

  signalCount.textContent = `(${sortedSignals.length})`;
  signalList.replaceChildren();

  if (sortedSignals.length === 0) {
    noSignal.hidden = false;
    signalList.hidden = true;
  } else {
    noSignal.hidden = true;
    signalList.hidden = false;

    sortedSignals.forEach((sig) => {
      const li = document.createElement('li');

      const row = document.createElement('div');
      row.className = 'signal-row';

      const pill = document.createElement('span');
      pill.className = `severity-pill sev--${sig.severity}`;
      pill.textContent = sig.severity === 'high' ? '높음' : sig.severity === 'medium' ? '보통' : '낮음';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'signal-label';
      labelSpan.textContent = sig.label;

      row.appendChild(pill);
      row.appendChild(labelSpan);
      li.appendChild(row);

      if (sig.evidence) {
        const evidenceP = document.createElement('p');
        evidenceP.className = 'signal-evidence';
        evidenceP.textContent = `근거: “${sig.evidence}”`;
        li.appendChild(evidenceP);
      }

      signalList.appendChild(li);
    });
  }

  // 안전 거래 수칙 채우기
  tipsList.replaceChildren();
  const tips = TIPS[data.riskLevel] || TIPS.safe;
  tips.forEach((tipText) => {
    const tipLi = document.createElement('li');
    tipLi.textContent = tipText;
    tipsList.appendChild(tipLi);
  });

  // 부드럽게 결과 카드로 스크롤 이동
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 4. 오류 표시 상태 (error)
function showError(code) {
  postInput.disabled = false;
  sampleBtns.forEach((btn) => (btn.disabled = false));
  resetBtn.disabled = false;
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = '분석하기';

  loading.hidden = true;
  resultSection.hidden = true;
  errorSection.hidden = false;

  const msg = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR;
  errorMessage.textContent = msg;

  if (RETRYABLE_CODES.includes(code)) {
    retryBtn.hidden = false;
  } else {
    retryBtn.hidden = true;
  }

  errorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 글자 수 세기 및 업데이트
function updateCharCount() {
  const len = postInput.value.length;
  charCount.textContent = `${len} / ${LIMITS.MAX_LENGTH}`;
  if (len > LIMITS.MAX_LENGTH) {
    charCount.classList.add('is-over');
  } else {
    charCount.classList.remove('is-over');
  }
}

// 분석 요청 메인 함수
async function analyzePost() {
  if (isLoading) return;

  const text = postInput.value.trim();

  // 클라이언트 사전 검사
  if (text.length === 0) {
    showError('EMPTY_INPUT');
    return;
  }
  if (text.length < LIMITS.MIN_LENGTH) {
    showError('TOO_SHORT');
    return;
  }
  if (text.length > LIMITS.MAX_LENGTH) {
    showError('TOO_LONG');
    return;
  }

  showLoading();
  isLoading = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, LIMITS.CLIENT_TIMEOUT_MS);

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let json;
    try {
      json = await res.json();
    } catch {
      showError('UNKNOWN_ERROR');
      return;
    }

    if (json.ok === true) {
      showResult(json.data);
    } else {
      const errorCode = json?.error?.code;
      if (errorCode && ERROR_MESSAGES[errorCode]) {
        showError(errorCode);
      } else {
        showError('UNKNOWN_ERROR');
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      showError('CLIENT_TIMEOUT');
    } else if (err instanceof TypeError) {
      showError('NETWORK_ERROR');
    } else {
      showError('UNKNOWN_ERROR');
    }
  } finally {
    isLoading = false;
  }
}

// 이벤트 리스너 등록
postInput.addEventListener('input', () => {
  updateCharCount();
  // 사용자가 입력을 수정하기 시작하면 오류 카드를 자동으로 숨김
  if (!errorSection.hidden) {
    errorSection.hidden = true;
  }
});

sampleBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const sampleType = btn.dataset.sample;
    if (SAMPLE_POSTS[sampleType]) {
      postInput.value = SAMPLE_POSTS[sampleType];
      updateCharCount();
      errorSection.hidden = true;
      resultSection.hidden = true;
      postInput.focus();
    }
  });
});

analyzeBtn.addEventListener('click', analyzePost);
retryBtn.addEventListener('click', analyzePost);

resetBtn.addEventListener('click', () => {
  postInput.value = '';
  updateCharCount();
  showIdle();
  postInput.focus();
});

// 초기 상태 세팅
showIdle();
updateCharCount();
