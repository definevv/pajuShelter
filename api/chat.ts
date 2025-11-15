import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY, // Vercel 환경변수에서 가져옴
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { messages } = req.body as {
      messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    };

    // 안전 가이드 역할을 고정하는 system 메시지
    const systemMessage = {
      role: 'system' as const,
      content:
        '너는 한국 파주시 기준의 지진 대피 안전 가이드야. ' +
        '최대한 간단하고 실질적인 행동요령을 한국어로 설명하고, 불필요하게 겁을 주지 말고 침착하게 안내해.',
    };

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [systemMessage, ...messages],
      temperature: 0.3,
      max_tokens: 512,
    });

    const reply =
      completion.choices[0]?.message?.content ??
      '지금은 답변을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.';

    res.status(200).json({ reply });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Groq 요청 중 오류가 발생했습니다.' });
  }
}