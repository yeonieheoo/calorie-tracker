# 🍃 Calorie Tracker

Yeonie 전용 칼로리 트래커. 자연어 입력 → Claude AI가 자동 칼로리 계산 → 폰/랩탑 실시간 동기화.

## ⚙️ 셋업 (한 번만, 약 30분)

### 1️⃣ Anthropic API 키 발급 (5분)

1. https://console.anthropic.com → 가입
2. **Billing** → 결제 수단 추가 (사용량만큼만 청구, 보통 월 $1-3)
3. **API Keys** → "Create Key" → 이름 `calorie-tracker` → 키 복사
4. 키 안전한 곳에 저장 (다시 못 봄)

### 2️⃣ Supabase 셋업 (10분)

1. https://supabase.com → "Start your project" → GitHub 로그인
2. **New project**:
   - Name: `calorie-tracker`
   - DB Password: 강력하게 (저장해두기)
   - Region: `Southeast Asia (Singapore)` (Dubai 가까움)
3. 프로젝트 생성 대기 (2-3분)
4. 왼쪽 메뉴 **SQL Editor** → "New query" → `supabase-schema.sql` 내용 붙여넣고 **Run**
5. 왼쪽 메뉴 **Settings → API**:
   - **Project URL** 복사 (예: `https://xxxx.supabase.co`)
   - **anon public** 키 복사
6. 왼쪽 메뉴 **Authentication → Providers → Email** 확인 (기본 활성화됨)

### 3️⃣ GitHub Repo 만들기 (3분)

```bash
# 이 폴더에서 (cd /path/to/calorie-tracker)
git init
git add .
git commit -m "Initial commit"
gh repo create calorie-tracker --private --source=. --push
```

또는 웹에서:
1. https://github.com/new → repo 이름 `calorie-tracker` → Private → Create
2. 안내대로 푸시

### 4️⃣ Vercel 배포 (10분)

1. https://vercel.com → GitHub로 로그인
2. **Add New → Project** → `calorie-tracker` repo 선택 → Import
3. **Environment Variables** 추가:
   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
   | `ANTHROPIC_API_KEY` | Anthropic 키 |
4. **Deploy** 클릭
5. 1-2분 후 URL 생성 (예: `calorie-tracker-yeonie.vercel.app`)

### 5️⃣ Supabase 리다이렉트 URL 등록

1. Supabase → **Authentication → URL Configuration**
2. **Site URL**: Vercel URL 입력 (예: `https://calorie-tracker-yeonie.vercel.app`)
3. **Redirect URLs**: 같은 URL 추가
4. Save

### 6️⃣ 폰 홈화면에 추가

**iPhone (Safari):**
1. 위 URL을 사파리에서 열기
2. 공유 버튼 (□↑) 탭
3. **"홈 화면에 추가"**
4. 이름 `Tracker` → 추가

**Android (Chrome):**
1. 위 URL을 크롬에서 열기
2. 오른쪽 위 점 3개 메뉴
3. **"홈 화면에 추가"**
4. 설치

### 7️⃣ 첫 사용

1. PWA 또는 URL 열기
2. 이메일 입력 → "매직 링크 보내기"
3. 메일 받은 링크 클릭 → 로그인 완료
4. 끝 — 이제 폰/랩탑 어디서든 같은 데이터

---

## 🚀 로컬 개발

```bash
npm install
cp .env.example .env.local
# .env.local 채우기

npm run dev
```

## 📁 구조

```
├── api/chat.js              ← Anthropic API 프록시 (Vercel serverless)
├── src/
│   ├── App.jsx              ← Auth 라우팅
│   ├── components/
│   │   ├── Auth.jsx         ← Magic link 로그인
│   │   └── Tracker.jsx      ← 메인 트래커
│   └── lib/supabase.js      ← DB 클라이언트
├── public/icon-*.png        ← PWA 아이콘
├── supabase-schema.sql      ← DB 스키마
└── vite.config.js           ← PWA 설정
```

## 💡 사용 예시

- `"점심에 김밥 한 줄이랑 아아"` → 음식 자동 분류
- `"러닝 30분"` → 운동 자동 칼로리 계산
- `"하체 웨이트 1시간 + 인클라인 15분"` → 복합 운동
- `"방금 거 삭제"` → 마지막 기록 삭제
- `"오늘 얼마 남았어?"` → 잔여량 질문

## 💰 비용

- **Vercel**: 무료 (Hobby plan으로 충분)
- **Supabase**: 무료 (500MB DB, 평생 충분)
- **Anthropic API**: 사용량 기반, 매일 평균 입력 10번 기준 월 $1-2

## 🔧 수정하고 싶은 것

- 목표 칼로리/단백질: `src/components/Tracker.jsx` 맨 위 `SETTINGS`
- 시스템 프롬프트: `api/chat.js` 상단 `SYSTEM_PROMPT`
- 색상: `src/index.css` + Tailwind 클래스

수정 후 GitHub에 푸시하면 Vercel이 자동 재배포.
