import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { symptoms } = await req.json()
if (!symptoms || typeof symptoms !== "string") {
  return NextResponse.json({ answer: "No se recibieron síntomas válidos." }, { status: 400 })
}

  const prompt = `Eres un asistente médico educativo. Un paciente dice: "${symptoms}". Devuelve una respuesta clara, en español, explicando posibles causas sin dar diagnósticos, y recomendaciones para buscar ayuda médica.`

  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    })
  })

  const data = await response.json()
  const answer = data.choices?.[0]?.message?.content || "Lo siento, no pude procesar tu solicitud."

  return NextResponse.json({ answer })
}
