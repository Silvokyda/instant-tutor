import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const { messages, plan } = body || {};

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "messages must be an array of { role, content }",
      });
    }

    // Fallback if no plan: generic tutor
    const hasPlan = plan && plan.title && Array.isArray(plan.lessons);

    const courseContext = hasPlan
      ? `
You are an AI tutor for this mini-course:

Topic: ${plan.topic}
Level: ${plan.level}
Goal: ${plan.goal}
Tone: ${plan.tone}

Course title: ${plan.title}
Description: ${plan.description}

Lessons:
${plan.lessons
  .map(
    (l, i) =>
      `  ${i + 1}. ${l.title}: ${l.summary} (key points: ${
        (l.key_points || []).join(", ") || "n/a"
      })`
  )
  .join("\n")}

Use this course structure as context when answering.
      `.trim()
      : `
You are an AI tutor. The user may ask you to explain concepts or help them learn.
If they mention a topic, adopt it and teach step by step.
      `.trim();

    const systemMessage = {
      role: "system",
      content: `
${courseContext}

General behavior:
- Be clear, friendly, and concise.
- Prefer step-by-step explanations.
- Ask short check-in questions sometimes ("Does that make sense?", etc.).
- Adapt explanations to the user's apparent level.
- If the user seems confused, simplify and use analogies.

When answering, stay focused on helping the user learn.
      `.trim(),
    };

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 600,
      stream: false,
    });

    const reply = completion.choices?.[0]?.message?.content || "";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Error in /api/chat:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}