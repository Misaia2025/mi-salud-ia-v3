// app/api/deepseek/route.ts
import { NextRequest } from "next/server"

export const runtime = "edge"   // ejecuta en el Edge Runtime de Vercel (rápido y gratis)

export async function POST(req: NextRequest) {
  // 1️⃣ Extraemos lo que envía el frontend
  const { symptoms, age, sex, conditions } = await req.json()

  // 2️⃣ Creamos los mensajes para el LLM
  const messages = [
  {
    role: "system",
    content: `
Eres “Mi Salud IA”, un asistente virtual médico en español latinoamericano.
Objetivo:
1️⃣ Proporcionar **orientación medica general** y educativa, nunca un diagnóstico definitivo ni prescripción.
2️⃣ Responder en **máx. 200 palabras**.
3️⃣ Formato en **markdown** con los siguientes bloques, cada uno en su propio encabezado: 
   ## Resumen
   ## Diagnósticos diferenciales (máx 3, con % probabilidad, ordenados de mayor a menor)
   ## Señales de alarma (si aplica, bullets)
   ## Consejos de autocuidado (3 bullets)
   ## Descargo de responsabilidad
Si el usuario describe síntomas graves o “señales de alarma” claras (dolor torácico intenso, dificultad para respirar, pérdida de visión, etc.), anteponer un aviso: **“¡Busca atención médica inmediata!”**.

Responde siempre exclusivamente en español. No hagas suposiciones si la información es insuficiente; pídele datos adicionales en forma de preguntas si es necesario.`
  },
  {
    role: "user",
    content: `
Síntomas: ${symptoms}
Edad: ${age}
Sexo: ${sex}
Comorbilidades: ${conditions || "ninguna"}
`
  }
]

  // 3️⃣ Llamamos a DeepSeek Chat
  const apiRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY!}`
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      messages,
      stream: false,
      max_tokens: 400,
      temperature: 0.2
    })
  })

  // 4️⃣ Tomamos la respuesta
  const data = await apiRes.json()
  const text =
    data?.choices?.[0]?.message?.content ??
    "Lo siento, no pude generar una respuesta por el momento."

  // 5️⃣ Devolvemos JSON al frontend
  return new Response(JSON.stringify({ text }), {
    headers: { "Content-Type": "application/json" }
  })
}
