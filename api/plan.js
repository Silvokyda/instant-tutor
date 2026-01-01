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

    const { topic, level, goal, tone } = body || {};

    if (!topic || !level || !goal || !tone) {
      return res.status(400).json({
        error: "Missing required fields: topic, level, goal, tone",
      });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.6,
      max_tokens: 700,
      stream: false,
      messages: [
        {
          role: "system",
          content: `
You are an expert course designer.

Given a topic, level, goal, and tone, create a very short, focused mini-course.

Return STRICT JSON ONLY in this format (no markdown, no extra text):

{
  "title": "Short course title",
  "description": "2-3 sentence overview of the course.",
  "lessons": [
    {
      "title": "Lesson 1 title",
      "summary": "3-6 sentences explaining this lesson in simple terms.",
      "key_points": [
        "key idea 1",
        "key idea 2",
        "key idea 3"
      ]
    }
  ],
  "optional_project": "1-2 sentence mini project or practice task (optional, can be empty string)."
}

3-5 lessons is enough. Keep everything beginner-friendly if level is Beginner.
        `.trim(),
        },
        {
          role: "user",
          content: `
Topic: ${topic}
Level: ${level}
Goal: ${goal}
Tone: ${tone}

Remember: respond with JSON ONLY, following the schema exactly.
No comments, no markdown, no code fences.
          `.trim(),
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "";
    let modelPlan;
    try {
      modelPlan = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse plan JSON from model:", content);
      return res.status(500).json({
        error: "Failed to parse plan JSON from model",
      });
    }

    const plan = {
      ...modelPlan,
      topic,
      level,
      goal,
      tone,
    };

    return res.status(200).json({ plan });
  } catch (err) {
    console.error("Error in /api/plan:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}