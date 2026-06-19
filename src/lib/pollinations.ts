import outlineSkill from '../../skills/outlining/SKILL.md?raw';
import draftingSkill from '../../skills/drafting/SKILL.md?raw';
import humanizingSkill from '../../skills/humanizing/SKILL.md?raw';

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
  volumes: number;
  pagesPerVolume: number;
  apiKey?: string;
}): Promise<{ title: string; chapters: { number: number; volumeNumber: number; volumeTitle: string; title: string; summary: string; targetPages?: number }[] }> {
  const chaptersPerVolume = Math.max(3, Math.round(args.pagesPerVolume / 13.5));
  const totalChapters = chaptersPerVolume * args.volumes;

  const prompt = `
You are the Outlining Agent. Use the following outlining skill rules:
${outlineSkill}

Your task is to outline a book series with the following specifications:
- Description: ${args.description}
- Genre: ${args.genre}
- Language: ${args.language}
- Number of Volumes: ${args.volumes}
- Target Pages per Volume: ${args.pagesPerVolume} (about ${args.pagesPerVolume * 250} words)
- Expected Chapters per Volume: ${chaptersPerVolume} chapters
- Target Pages per Chapter: Between 11 and 16 pages (about 2750 to 4000 words) depending on chapter story flow.

You MUST return ONLY a valid JSON object with the following structure:
{
  "title": "Book Series Title",
  "chapters": [
    {
      "number": 1,
      "volumeNumber": 1,
      "volumeTitle": "Volume 1 Title",
      "title": "Chapter 1 Title",
      "summary": "Detailed narrative beats and summary of what happens in this chapter.",
      "targetPages": 13
    }
  ]
}
Ensure there are exactly ${totalChapters} chapters, with ${chaptersPerVolume} chapters per volume.
Each chapter's "targetPages" MUST be an integer between 11 and 16 representing the dynamic page target for that chapter based on the story flow.
Ensure the sum of "targetPages" of the chapters in each volume is approximately equal to ${args.pagesPerVolume}.
Output MUST be valid JSON. Ensure there are no markdown backticks at the very start/end of the JSON return if possible, or format it as clean JSON.`;

  const raw = await chatCompletion(prompt, args.model, args.apiKey, true);
  const jsonStr = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(jsonStr);
}

export async function generateChapterBeats(args: {
  bookDescription: string;
  genre: string;
  language: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterSummary: string;
  volumeNumber?: number;
  previousChaptersSummaries?: string;
  model: string;
  apiKey?: string;
}): Promise<string> {
  const prompt = `
You are the Outlining/Beats Agent.
Book Description: ${args.bookDescription}
Genre: ${args.genre}
Language: ${args.language}
Volume: ${args.volumeNumber || 1}
Chapter ${args.chapterNumber}: ${args.chapterTitle}
Chapter Summary: ${args.chapterSummary}

Previous context:
${args.previousChaptersSummaries || "None."}

Write 5-7 detailed scene beats (bullet points) for Chapter ${args.chapterNumber}.
Each beat should specify the setting, character emotions, actions, and key dialogue points.
Return only the bullet points.
`;
  return chatCompletion(prompt, args.model, args.apiKey, false);
}

export async function draftChapter(args: {
  bookDescription: string;
  genre: string;
  language: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterSummary: string;
  chapterBeats: string;
  previousChaptersSummaries?: string;
  previousChapterEnding?: string;
  model: string;
  apiKey?: string;
  targetPages?: number;
}): Promise<{ content: string; wordCount: number }> {
  let fullContent = "";
  let currentWords = 0;
  const pages = args.targetPages || 13;
  const targetWords = pages * 250;
  const maxIterations = Math.ceil(targetWords / 600);

  for (let i = 0; i < maxIterations && currentWords < targetWords; i++) {
    const isContinuing = i > 0;
    const prompt = `
You are the Drafting Agent. Use the following drafting skill rules:
${draftingSkill}

Book Description: ${args.bookDescription}
Genre: ${args.genre}
Language: ${args.language}
Current Task: Write Chapter ${args.chapterNumber}: ${args.chapterTitle}

Chapter Outline Beats:
${args.chapterBeats}

Context regarding previous chapters:
${args.previousChaptersSummaries || "None yet."}

${
  isContinuing
    ? `You have already written some content. The last part was: "...${args.previousChapterEnding || fullContent.slice(-500)}"
Please CONTINUE writing this chapter from where you left off, following the chapter beats. Do not repeat yourself. Focus on narrative flow, dialogue, and character development.`
    : "Start writing the chapter draft now, based on the beats."
}

This chapter target length is ${pages} pages (about ${targetWords} words total).
${isContinuing ? "Continue writing the chapter draft." : "Write at least 800 words for this segment."}
`;

    const chunk = await chatCompletion(prompt, args.model, args.apiKey, false);
    fullContent += (isContinuing ? "\n\n" : "") + chunk;
    currentWords = countWords(fullContent);
    if (chunk.length < 200) break;
  }

  return { content: fullContent, wordCount: currentWords };
}

export async function humanizeChapter(args: {
  draftContent: string;
  genre: string;
  language: string;
  model: string;
  apiKey?: string;
}): Promise<string> {
  const prompt = `
You are the Humanizer and Revision Agent. Use the following humanizing skill rules:
${humanizingSkill}

Genre: ${args.genre}
Language: ${args.language}

Review and revise the following draft text to make it sound human-written, engaging, and polished:
----
${args.draftContent}
----

Return ONLY the polished, refined chapter prose. Do not include any meta comments or introductory notes.
`;
  return chatCompletion(prompt, args.model, args.apiKey, false);
}

// Kept for backward compatibility if any component calls the old generateChapter directly
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
  targetPages?: number;
}): Promise<{ content: string; wordCount: number }> {
  // Runs the agentic pipeline
  const beats = await generateChapterBeats(args);
  const draft = await draftChapter({ ...args, chapterBeats: beats });
  const humanized = await humanizeChapter({
    draftContent: draft.content,
    genre: args.genre,
    language: args.language,
    model: args.model,
    apiKey: args.apiKey
  });
  return { content: humanized, wordCount: countWords(humanized) };
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

