// 화면 동작과 사용자 인터랙션을 제어하는 메인 스크립트입니다.
import { SAMPLE_POSTS, TIPS, ERROR_MESSAGES, RETRYABLE_CODES, LIMITS } from './constants.js';

// DOM 요소 참조
const postInput = document.getElementById('post-input');
const charCount = document.getElementById('char-count');
const sampleBtns = document.querySelectorAll('.sample-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const resetBtn = document.getElementById('reset-btn');

// 이미지 관련 DOM
const imageInput = document.getElementById('image-input');
const imageDropzone = document.getElementById('image-dropzone');
const dropzoneText = document.getElementById('dropzone-text');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');

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

// 상태 변수
let isLoading = false;
let currentImageData = null; // base64 data url

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

  riskBadge.className = '';
  riskBadge.classList.add(`badge--${data.riskLevel}`);
  if (data.riskLevel === 'danger') {
    riskBadge.textContent = '🚨 위험';
  } else if (data.riskLevel === 'caution') {
    riskBadge.textContent = '⚠️ 주의';
  } else {
    riskBadge.textContent = '✅ 안전';
  }

  confidenceValue.textContent = `${data.confidence}%`;
  confidenceBar.setAttribute('aria-valuenow', String(data.confidence));
  confidenceFill.style.width = `${data.confidence}%`;
  confidenceFill.className = '';
  confidenceFill.classList.add(`fill--${data.riskLevel}`);

  reasonText.textContent = data.reason;

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

  tipsList.replaceChildren();
  const tips = TIPS[data.riskLevel] || TIPS.safe;
  tips.forEach((tipText) => {
    const tipLi = document.createElement('li');
    tipLi.textContent = tipText;
    tipsList.appendChild(tipLi);
  });

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

// 글자 수 업데이트
function updateCharCount() {
  const len = postInput.value.length;
  charCount.textContent = `${len} / ${LIMITS.MAX_LENGTH}`;
  if (len > LIMITS.MAX_LENGTH) {
    charCount.classList.add('is-over');
  } else {
    charCount.classList.remove('is-over');
  }
}

// 이미지 파일 선택 처리
function handleImageFile(file) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('이미지 파일(PNG, JPG, WEBP)만 첨부할 수 있어요.');
    return;
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    alert('이미지 크기는 최대 5MB까지만 가능해요.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageData = e.target.result;
    imagePreview.src = currentImageData;
    dropzoneText.hidden = true;
    imagePreviewContainer.hidden = false;
  };
  reader.readAsDataURL(file);
}

// 이미지 제거
function clearImage() {
  currentImageData = null;
  imageInput.value = '';
  imagePreview.src = '';
  imagePreviewContainer.hidden = true;
  dropzoneText.hidden = false;
}

// 분석 요청
async function analyzePost() {
  if (isLoading) return;

  const text = postInput.value.trim();

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
    const payload = { text };
    if (currentImageData) {
      payload.image = currentImageData;
    }

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
  if (!errorSection.hidden) {
    errorSection.hidden = true;
  }
});

// 이미지 드롭존 이벤트
imageDropzone.addEventListener('click', (e) => {
  if (e.target === removeImageBtn) return;
  imageInput.click();
});

imageDropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    imageInput.click();
  }
});

imageInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  handleImageFile(file);
});

removeImageBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearImage();
});

imageDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  imageDropzone.classList.add('is-dragover');
});

imageDropzone.addEventListener('dragleave', () => {
  imageDropzone.classList.remove('is-dragover');
});

imageDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  imageDropzone.classList.remove('is-dragover');
  const file = e.dataTransfer.files?.[0];
  handleImageFile(file);
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
  clearImage();
  updateCharCount();
  showIdle();
  postInput.focus();
});

// 초기화
showIdle();
updateCharCount();
