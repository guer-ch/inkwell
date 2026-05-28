import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { jsPDF } from "jspdf";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Helper to count words
function countWords(str: string) {
  return str.split(/\s+/).filter(word => word.length > 0).length;
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
  const { description, genre, language, model = "gemini", apiKey } = req.body;
  const prompt = `Generate a book outline for a ${genre} book in ${language}. 
  Description: ${description}
  
  Return ONLY a JSON object with the following structure:
  {
    "title": "Book Title",
    "chapters": [
      { "number": 1, "title": "Chapter Title", "summary": "Detailed summary of what happens in this chapter." }
    ]
  }
  Ensure there are at least 10 chapters. Output MUST be valid JSON.`;

  try {
    const result = await generateText(prompt, model, apiKey);
    // Pollinations might return markdown with json inside
    const jsonStr = result.replace(/```json|```/g, "").trim();
    const outline = JSON.parse(jsonStr);
    res.json(outline);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate outline" });
  }
});

// 2. Generate Chapter
app.post("/api/generate-chapter", async (req, res) => {
  const { 
    book_description, genre, language, chapter_number, chapter_title, 
    chapter_summary, previous_chapters_summaries, previous_chapter_ending,
    model = "gemini", apiKey
  } = req.body;

  let fullContent = "";
  let currentWords = 0;
  const targetWords = 1500;
  let iterations = 0;
  const maxIterations = 4; // Max attempts to avoid infinite loops

  try {
    while (currentWords < targetWords && iterations < maxIterations) {
      const isContinuing = iterations > 0;
      const prompt = `
        You are writing a ${genre} book in ${language}. 
        Book Description: ${book_description}
        Genre: ${genre}
        Language: ${language}
        
        Current Task: Write Chapter ${chapter_number}: ${chapter_title}.
        Chapter Summary: ${chapter_summary}
        
        Context regarding previous chapters:
        ${previous_chapters_summaries || "None yet."}
        
        ${isContinuing ? `You have already written some content. The last part was: "...${previous_chapter_ending || fullContent.slice(-500)}"
        Please CONTINUE writing this chapter from where you left off. Do not repeat yourself. Focus on narrative flow, dialogue, and deep character development.` : 
        "Start writing the chapter now. Focus on descriptive prose and immersive storytelling."}
        
        ${isContinuing ? "Continue until you reach a natural pause or significant length." : "Write at least 800 words for this segment."}
      `;

      const chunk = await generateText(prompt, model, apiKey);
      fullContent += (isContinuing ? "\n\n" : "") + chunk;
      currentWords = countWords(fullContent);
      iterations++;
      
      // If we are close enough or getting repetitive, we might stop
      if (chunk.length < 200) break; 
    }

    res.json({ content: fullContent, wordCount: currentWords });
  } catch (error) {
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
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
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
  const { title, author, chapters, coverUrl } = req.body;
  
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title Page
    doc.setFont("serif", "bold");
    doc.setFontSize(30);
    doc.text(title, pageWidth / 2, 100, { align: "center" });
    
    doc.setFontSize(18);
    doc.text(`By ${author || "AI Author"}`, pageWidth / 2, 120, { align: "center" });
    
    // Table of Contents
    doc.addPage();
    doc.setFontSize(20);
    doc.text("Table of Contents", 20, 30);
    doc.setFontSize(12);
    chapters.forEach((ch: any, i: number) => {
      doc.text(`Chapter ${ch.number}: ${ch.title}`, 20, 50 + (i * 10));
    });
    
    // Chapters
    chapters.forEach((ch: any) => {
      doc.addPage();
      doc.setFont("serif", "bold");
      doc.setFontSize(22);
      doc.text(`Chapter ${ch.number}: ${ch.title}`, 20, 30);
      
      doc.setFont("serif", "normal");
      doc.setFontSize(11);
      const splitText: string[] = doc.splitTextToSize(ch.content, pageWidth - 40);
      
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
  const { title, chapters } = req.body;
  let md = `# ${title}\n\n`;
  chapters.forEach((ch: any) => {
    md += `## Chapter ${ch.number}: ${ch.title}\n\n${ch.content}\n\n`;
  });
  
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${title}.md"`);
  res.send(md);
});

async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production" || 
    (await import("fs").then(fs => fs.existsSync(path.join(distPath, "index.html"))));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
