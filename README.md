# 안심거래 체크 (중고거래 사기 게시글 판별기)

중고거래 판매글을 붙여넣으면 AI가 사기 위험도를 판정하고, 얼마나 확신하는지와 그 이유를 알려주는 웹 서비스입니다.

> **면책 문구**  
> 이 서비스의 판정은 참고용이며 사기 여부를 보장하지 않습니다.  
> 사기 피해가 의심되면 [경찰청 사이버범죄 신고시스템(ECRM)](https://ecrm.police.go.kr)에 신고하거나 112에 연락하세요.

---

## 1. 준비물

| 준비물 | 확인 방법 | 비고 |
|---|---|---|
| Node.js 20 이상 | 터미널에서 `node -v` → `v20.x.x` 이상 | nodejs.org에서 LTS 버전 설치 권장 |
| npm | `npm -v` | Node.js 설치 시 함께 제공 |
| OpenAI API 키 | platform.openai.com → API keys | `sk-`로 시작하는 비밀키 |
| GitHub 계정 | | 배포 시 저장소 연결에 필요 |
| Vercel 계정 | | GitHub 계정으로 간편 가입 |

---

## 2. 실행 방법

```bash
# 1) 패키지 설치
npm install

# 2) 환경변수 파일 만들기
# Mac / Linux:
cp .env.example .env
# Windows PowerShell:
Copy-Item .env.example .env

# 3) .env 파일을 열어 OPENAI_API_KEY에 실제 OpenAI API 키 입력

# 4) 로컬 개발 서버 실행
npm run dev

# 5) 브라우저에서 접속
# http://localhost:3000
```

---

## 3. 환경변수 설명

| 변수명 | 필수 여부 | 기본값 | 설명 |
|---|---|---|---|
| `OPENAI_API_KEY` | **필수** | (없음) | OpenAI API 비밀키 (`sk-...`) |
| `OPENAI_MODEL` | 선택 | `gpt-4o-mini` | 사용할 OpenAI 모델명 |
| `AI_TIMEOUT_MS` | 선택 | `15000` | AI 분석 응답 대기 시간 (밀리초 단위, 기본 15초) |

---

## 4. 배포 방법 요약 (Vercel)

자세한 배포 방법은 [docs/06-deployment.md](used-trade-checker-docs/docs/06-deployment.md)를 참고하세요.

1. GitHub에 새 저장소를 생성하고 프로젝트 코드를 push합니다. (`.env` 파일은 절대 올리지 않습니다)
2. [Vercel](https://vercel.com)에 로그인한 뒤 해당 GitHub 저장소를 Import합니다.
   - **Framework Preset**: `Other`
   - **Build Command**: 비워 둠
   - **Output Directory**: 비워 둠 (`vercel.json`의 `public` 자동 인식)
3. **Environment Variables**에 아래 3가지를 추가하고 **Deploy**를 클릭합니다.
   - `OPENAI_API_KEY`: 실제 API 키
   - `OPENAI_MODEL`: `gpt-4o-mini`
   - `AI_TIMEOUT_MS`: `15000`
4. 배포 완료 후 제공되는 Vercel 도메인으로 접속해 서비스를 이용합니다.
