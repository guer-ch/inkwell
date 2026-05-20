// Client-side Pollinations.ai helpers.
// Docs: https://enter.pollinations.ai/api/docs/llm.txt
// All requests go directly from the browser - Pollinations is CORS-enabled.

const TEXT_BASE = "https://gen.pollinations.ai/v1/chat/completions";
const IMAGE_BASE = "https://image.pollinations.ai/prompt";

function countWords(str: string) {
  return str.split(/\s+/).filter(w => w.length > 0).length;
}

async function chatCompletion(
  prompt: string,
  model: string,
  apiKey?: string,
  jsonMode: boolean = false
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const body: any = {
    model,
    messages: [{ role: "user", content: prompt }],
    seed: Math.floor(Math.random() * 1000000)
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(TEXT_BASE, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pollinations text API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  if (typeof data === "string") return data;
  return JSON.stringify(data);
}

export async function generateOutline(args: {
  description: string;
  genre: string;
  language: string;
  model: string;
  apiKey?: string;
}): Promise<{ title: string; chapters: { number: number; title: string; summary: string }[] }> {
  const prompt = `Generate a book outline for a ${args.genre} book in ${args.language}.
Description: ${args.description}

Return ONLY a JSON object with the following structure:
{
  "title": "Book Title",
  "chapters": [
    { "number": 1, "title": "Chapter Title", "summary": "Detailed summary of what happens in this chapter." }
  ]
}
Ensure there are at least 10 chapters. Output MUST be valid JSON.`;

  const raw = await chatCompletion(prompt, args.model, args.apiKey, true);
  const jsonStr = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(jsonStr);
}

export async function generateChapter(args: {
  bookDescription: string;
  genre: string;
  language: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterSummary: string;
  previousChaptersSummaries?: string;
  previousChapterEnding?: string;
  model: string;
  apiKey?: string;
}): Promise<{ content: string; wordCount: number }> {
  let fullContent = "";
  let currentWords = 0;
  const targetWords = 1500;
  const maxIterations = 4;

  for (let i = 0; i < maxIterations && currentWords < targetWords; i++) {
    const isContinuing = i > 0;
    const prompt = `
You are writing a ${args.genre} book in ${args.language}.
Book Description: ${args.bookDescription}
Genre: ${args.genre}
Language: ${args.language}

Current Task: Write Chapter ${args.chapterNumber}: ${args.chapterTitle}.
Chapter Summary: ${args.chapterSummary}

Context regarding previous chapters:
${args.previousChaptersSummaries || "None yet."}

${
  isContinuing
    ? `You have already written some content. The last part was: "...${args.previousChapterEnding || fullContent.slice(-500)}"
Please CONTINUE writing this chapter from where you left off. Do not repeat yourself. Focus on narrative flow, dialogue, and deep character development.`
    : "Start writing the chapter now. Focus on descriptive prose and immersive storytelling."
}

${isContinuing ? "Continue until you reach a natural pause or significant length." : "Write at least 800 words for this segment."}
`;

    const chunk = await chatCompletion(prompt, args.model, args.apiKey, false);
    fullContent += (isContinuing ? "\n\n" : "") + chunk;
    currentWords = countWords(fullContent);
    if (chunk.length < 200) break;
  }

  return { content: fullContent, wordCount: currentWords };
}

export async function generateCover(args: {
  title: string;
  genre: string;
  description: string;
  model: string;
  apiKey?: string;
}): Promise<{ imageUrl: string }> {
  const prompt = `A cinematic, high-quality book cover for a ${args.genre} novel titled "${args.title}".
Description: ${args.description}.
Professional design, artistic style, 3:4 aspect ratio.`;

  const encoded = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 10000);
  let url = `${IMAGE_BASE}/${encoded}?width=600&height=800&model=${args.model}&nologo=true&seed=${seed}`;

  // If user supplied a key, append it as a query param so the GET request can authenticate.
  if (args.apiKey) {
    url += `&key=${encodeURIComponent(args.apiKey)}`;
  }

  return { imageUrl: url };
}
