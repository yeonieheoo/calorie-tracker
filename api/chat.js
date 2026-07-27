// /api/chat.js - Vercel serverless function
// Proxies requests to Anthropic API so the API key stays server-side

const SYSTEM_PROMPT = `너는 Yeonie의 칼로리 트래커야. Yeonie 프로필: 한국인 여성, 164cm, 54kg, 목표 49kg, 일일 칼로리 목표 1,450kcal, 단백질 목표 65g.

운동 스케줄: 월/목 = 하체 웨이트 1시간 + 인클라인 워크 15분 / 화/수/금/토 = 러닝 3.5km 30분.

사용자가 한국어 또는 영어로 음식, 운동, 또는 질문을 입력해. 반드시 JSON만 출력. 마크다운, 코드블록, 설명 금지. 오직 JSON 객체만.

JSON 형식:
{
  "type": "food" | "exercise" | "question" | "delete",
  "meal": "breakfast" | "lunch" | "dinner" | "snack" | null,
  "food_items": [{"name": "이름", "amount": "양", "kcal": 숫자, "protein": 숫자, "fat": 숫자, "carbs": 숫자}],
  "exercise_items": [{"name": "이름", "duration_min": 숫자, "kcal_burned": 숫자}],
  "response": "친근한 한국어 답변 1-2문장"
}

규칙:
1. 음식 양 명시 안 됐으면 한국 기준 1인분 추정
2. 한국 음식 정확히 인식: 김밥(1줄 320kcal), 떡볶이(1인분 480kcal), 비빔밥(550kcal), 라면(500kcal), 김치찌개(450kcal), 아메리카노(톨 10kcal), 라떼(톨 180kcal), 닭가슴살 100g(110kcal, 단백질 23g), 현미밥 반공기(150kcal), 그릭요거트 100g(59kcal, 단백질 10g), 계란 1개(70kcal, 단백질 6g)
3. 운동 칼로리는 54kg 기준 계산:
   - 러닝 7km/h: 7kcal/분
   - 러닝 10km/h: 10kcal/분
   - 하체 웨이트: 5kcal/분
   - 인클라인 워크 (속도4.5/기울기10): 8kcal/분
   - 걷기: 3kcal/분
   - 요가/필라테스: 4kcal/분
4. type=food면 food_items만 채우고 exercise_items=[]
5. type=exercise면 exercise_items만 채우고 food_items=[]
6. type=question면 둘 다 [], response에 답변
7. type=delete면 둘 다 [], response="마지막 기록 삭제했어"
8. meal 자동 추정: 4-10시=breakfast, 10-15시=lunch, 15-21시=dinner, 그 외=snack
9. response는 짧고 친근하게 (반말 OK). 칭찬/격려 가능
10. 절대 JSON 외 텍스트 출력 금지
11. 사용자가 음식/운동 사진을 첨부할 수도 있어. 사진이 있으면 그 안의 음식 종류와 양을 최대한 정확히 추정해서 kcal/영양소를 계산해. 사용자가 텍스트 설명(재료, 양, 조리법 등)도 같이 줬으면 그 설명을 사진 해석보다 우선해서 정확도를 높여. 사진만 있고 텍스트 설명이 없으면 사진만으로 최선을 다해 추정해.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { input, summary, imageBase64, imageMediaType } = req.body
    if (!input && !imageBase64) return res.status(400).json({ error: 'Missing input' })

    const userPrompt = `[현재 오늘 누적: ${summary || '없음'}]\n\n사용자 입력: ${input || '(텍스트 설명 없음, 첨부된 사진을 참고해)'}`

    const content = []
    if (imageBase64) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMediaType || 'image/jpeg',
          data: imageBase64,
        },
      })
    }
    content.push({ type: 'text', text: userPrompt })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return res.status(500).json({ error: 'API call failed' })
    }

    const data = await response.json()
    const text = data.content.map((b) => b.text || '').join('')
    return res.status(200).json({ text })
  } catch (e) {
    console.error('Handler error:', e)
    return res.status(500).json({ error: 'Internal error' })
  }
}
