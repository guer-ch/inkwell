import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { jsPDF } from "jspdf";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Helper to count words
function countWords(str: string) {
  return str.split(/\s+/).filter(word => word.length > 0).length;
}

// Helper to read agent skills securely
function getSkillContent(skillName: string): string {
  try {
    const filePath = path.join(process.cwd(), "skills", skillName, "SKILL.md");
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch (e) {
    console.warn(`Failed to read skill ${skillName}:`, e);
  }
  return "";
}

// AI Text Generation Helper
async function generateText(prompt: string, model: string = "gemini", apiKey?: string) {
  try {
    const headers: any = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const response = await axios.post("https://gen.pollinations.ai/v1/chat/completions", {
      messages: [{ role: "user", content: prompt }],
      model: model,
      seed: Math.floor(Math.random() * 1000000),
      jsonMode: prompt.toLowerCase().includes("json"),
      response_format: prompt.toLowerCase().includes("json") ? { type: "json_object" } : undefined
    }, { headers });

    if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      return response.data.choices[0].message.content;
    }
    if (typeof response.data === 'string') {
      return response.data;
    }
    return JSON.stringify(response.data);
  } catch (error: any) {
    if (error.response && error.response.data) {
      console.error("AI Generation Error Details:", JSON.stringify(error.response.data));
    } else {
      console.error("AI Generation Error:", error);
    }
    throw error;
  }
}

// 1. Generate Outline
app.post("/api/generate-outline", async (req, res) => {
  const { description, genre, language, volumes = 1, pagesPerVolume = 150, model = "gemini", apiKey } = req.body;
  const outlineSkill = getSkillContent("outlining");
  const chaptersPerVolume = Math.max(5, Math.round(pagesPerVolume / 10));
  const totalChapters = chaptersPerVolume * volumes;

  const prompt = `
You are the Outlining Agent. Use the following outlining skill rules:
${outlineSkill}

Your task is to outline a book series with the following specifications:
- Description: ${description}
- Genre: ${genre}
- Language: ${language}
- Number of Volumes: ${volumes}
- Target Pages per Volume: ${pagesPerVolume} (about ${pagesPerVolume * 250} words)
- Expected Chapters per Volume: ${chaptersPerVolume} chapters (target 10 pages / ~2500 words per chapter)
- Total Chapters across all volumes: ${totalChapters} chapters

You MUST return ONLY a valid JSON object with the following structure:
{
  "title": "Book Series Title",
  "chapters": [
    {
      "number": 1,
      "volumeNumber": 1,
      "volumeTitle": "Volume 1 Title",
      "title": "Chapter 1 Title",
      "summary": "Detailed narrative beats and summary of what happens in this chapter."
    }
  ]
}
Ensure there are exactly ${totalChapters} chapters, with ${chaptersPerVolume} chapters per volume.
Output MUST be valid JSON.`;

  try {
    const result = await generateText(prompt, model, apiKey);
    const jsonStr = result.replace(/```json|```/g, "").trim();
    const outline = JSON.parse(jsonStr);
    res.json(outline);
  } catch (error) {
    console.error("Outline generation error:", error);
    res.status(500).json({ error: "Failed to generate outline" });
  }
});

// 2. Generate Chapter
app.post("/api/generate-chapter", async (req, res) => {
  const { 
    book_description, genre, language, chapter_number, chapter_title, 
    chapter_summary, volumeNumber = 1, previous_chapters_summaries, previous_chapter_ending,
    model = "gemini", apiKey
  } = req.body;

  try {
    const draftingSkill = getSkillContent("drafting");
    const humanizingSkill = getSkillContent("humanizing");

    // 1. Generate beats first
    const beatsPrompt = `
You are the Outlining/Beats Agent.
Book Description: ${book_description}
Genre: ${genre}
Language: ${language}
Volume: ${volumeNumber}
Chapter ${chapter_number}: ${chapter_title}
Chapter Summary: ${chapter_summary}

Previous context:
${previous_chapters_summaries || "None."}

Write 5-7 detailed scene beats (bullet points) for Chapter ${chapter_number}.
Each beat should specify the setting, character emotions, actions, and key dialogue points.
Return only the bullet points.
`;
    const beats = await generateText(beatsPrompt, model, apiKey);

    // 2. Draft creative prose
    let fullContent = "";
    let currentWords = 0;
    const targetWords = 1500;
    let iterations = 0;
    const maxIterations = 4;

    while (currentWords < targetWords && iterations < maxIterations) {
      const isContinuing = iterations > 0;
      const prompt = `
You are the Drafting Agent. Use the following drafting skill rules:
${draftingSkill}

Book Description: ${book_description}
Genre: ${genre}
Language: ${language}
Current Task: Write Chapter ${chapter_number}: ${chapter_title}

Chapter Outline Beats:
${beats}

Context regarding previous chapters:
${previous_chapters_summaries || "None yet."}

${
  isContinuing
    ? `You have already written some content. The last part was: "...${previous_chapter_ending || fullContent.slice(-500)}"
Please CONTINUE writing this chapter from where you left off, following the chapter beats. Do not repeat yourself. Focus on narrative flow, dialogue, and character development.`
    : "Start writing the chapter draft now, based on the beats."
}

${isContinuing ? "Continue until you reach a natural pause or significant length." : "Write at least 800 words for this segment."}
`;

      const chunk = await generateText(prompt, model, apiKey);
      fullContent += (isContinuing ? "\n\n" : "") + chunk;
      currentWords = countWords(fullContent);
      iterations++;
      
      if (chunk.length < 200) break; 
    }

    // 3. Humanize
    const humanizePrompt = `
You are the Humanizer and Revision Agent. Use the following humanizing skill rules:
${humanizingSkill}

Genre: ${genre}
Language: ${language}

Review and revise the following draft text to make it sound human-written, engaging, and polished:
----
${fullContent}
----

Return ONLY the polished, refined chapter prose. Do not include any meta comments or introductory notes.
`;

    const humanized = await generateText(humanizePrompt, model, apiKey);
    res.json({ content: humanized, wordCount: countWords(humanized) });
  } catch (error) {
    console.error("Chapter generation error:", error);
    res.status(500).json({ error: "Failed to generate chapter" });
  }
});


// 3. Generate Cover
app.post("/api/generate-cover", async (req, res) => {
  const { title, genre, description, model = "klein", apiKey } = req.body;
  const prompt = `A cinematic, high-quality book cover for a ${genre} novel titled "${title}". 
  Description: ${description}. 
  Professional design, artistic style, 3:4 aspect ratio.`;
  
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=600&height=800&model=${model}&nologo=true&seed=${Math.floor(Math.random()*10000)}`;
  
  // Note: Pollinations Image API doesn't use the simple URL with an API key easily for BYOP 
  // without proxying the blob/stream if we want to keep the key secret.
  // However, for proxying to work correctly with headers, we might need a separate endpoint 
  // that fetches the image and returns it.
  
  // For now, if an API key is provided, we should ideally fetch it server-side.
  if (apiKey) {
    try {
      const response = await axios.get(imageUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        responseType: 'arraybuffer'
      });
      const base64 = Buffer.from(response.data).toString('base64');
      res.json({ imageUrl: `data:image/jpeg;base64,${base64}` });
      return;
    } catch (error) {
      console.error("Image BYOP fetch error:", error);
      // Fallback to simple URL if BYOP fails
    }
  }

  res.json({ imageUrl });
});

// 4. Export PDF
app.post("/api/export/pdf", async (req, res) => {
  const { title = "Untitled Book", author = "AI Author", chapters = [], coverUrl } = req.body;
  
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title Page
    doc.setFont("serif", "bold");
    doc.setFontSize(30);
    doc.text(title, pageWidth / 2, 100, { align: "center" });
    
    doc.setFontSize(18);
    doc.text(`By ${author}`, pageWidth / 2, 120, { align: "center" });
    
    const safeChapters = Array.isArray(chapters) ? chapters : [];

    // Table of Contents
    doc.addPage();
    doc.setFontSize(20);
    doc.text("Table of Contents", 20, 30);
    doc.setFontSize(12);
    safeChapters.forEach((ch: any, i: number) => {
      if (ch) {
        doc.text(`Chapter ${ch.number || (i + 1)}: ${ch.title || "Untitled"}`, 20, 50 + (i * 10));
      }
    });
    
    // Chapters
    safeChapters.forEach((ch: any, i: number) => {
      if (!ch) return;
      doc.addPage();
      doc.setFont("serif", "bold");
      doc.setFontSize(22);
      doc.text(`Chapter ${ch.number || (i + 1)}: ${ch.title || "Untitled"}`, 20, 30);
      
      doc.setFont("serif", "normal");
      doc.setFontSize(11);
      const splitText: string[] = doc.splitTextToSize(ch.content || "", pageWidth - 40);
      
      let y = 50;
      const margin = 20;
      const pageHeight = doc.internal.pageSize.getHeight();
      
      splitText.forEach((line) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, 20, y);
        y += 6; // line height
      });
    });
    
    const pdfOutput = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${title}.pdf"`);
    res.send(Buffer.from(pdfOutput));
  } catch (error) {
    console.error("PDF Export Error:", error);
    res.status(500).send("Export failed");
  }
});

// 5. Export Markdown
app.post("/api/export/markdown", (req, res) => {
  const { title = "Untitled Book", chapters = [] } = req.body;
  let md = `# ${title}\n\n`;
  const safeChapters = Array.isArray(chapters) ? chapters : [];
  safeChapters.forEach((ch: any, i: number) => {
    if (ch) {
      md += `## Chapter ${ch.number || (i + 1)}: ${ch.title || "Untitled"}\n\n${ch.content || ""}\n\n`;
    }
  });
  
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${title}.md"`);
  res.send(md);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
