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

    const { lesson, topic, level } = body || {};

    if (!lesson || !lesson.title || !lesson.summary) {
      return res.status(400).json({
        error: "Missing lesson (must include title and summary)",
      });
    }

    const completion = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      temperature: 0.7,
      max_tokens: 700,
      stream: false,
      messages: [
        {
          role: "system",
          content: `
You are a tutor creating a small quiz for a single lesson in a course.

Return STRICT JSON ONLY in this format:

{
  "questions": [
    {
      "question": "question text",
      "type": "short" or "mcq",
      "options": ["A", "B", "C", "D"],  // only if type is "mcq"
      "answer": "the correct answer or letter",
      "explanation": "1-3 sentence explanation of the answer"
    }
  ]
}

Generate 3-5 questions, mixing short-answer and multiple choice if appropriate.
Keep difficulty appropriate for the student level.
No extra text, no markdown, no code fences.
        `.trim(),
        },
        {
          role: "user",
          content: `
Create a quiz for this lesson from a course.

Topic: ${topic || "N/A"}
Level: ${level || "N/A"}

Lesson:
Title: ${lesson.title}
Summary: ${lesson.summary}
Key points: ${(lesson.key_points || []).join("; ")}

Remember: respond with JSON ONLY following the schema.
          `.trim(),
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse quiz JSON from model:", content);
      return res.status(500).json({
        error: "Failed to parse quiz JSON from model",
      });
    }

    return res.status(200).json({
      questions: parsed.questions || [],
    });
  } catch (err) {
    console.error("Error in /api/quiz:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}