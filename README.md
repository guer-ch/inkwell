<div align="center">
  <h1>📖 Inkwell AI</h1>
  <p>Transform your imagination into a fully written book — powered entirely by <a href="https://pollinations.ai">Pollinations.ai</a>.</p>
</div>

---

## What is Inkwell AI?

Inkwell AI is a full-stack web app that generates complete books from a short description. It uses **Pollinations.ai** for both text generation (story writing) and image generation (cover art) — no other AI API keys required.

## Features

- **Book outline generation** — structured chapters with summaries
- **AI cover art** — cinematic cover image generated from your book's theme
- **Full chapter writing** — each chapter written with narrative depth and continuity
- **Multiple AI models** — choose from Grok, GPT, Kimi, Claude, and more
- **Multiple image models** — FLUX, Grok Imagine, GPT Image, and more
- **Export to PDF or Markdown**
- **Library** — all generated books saved locally in the browser
- **Pollinations Pollen** — optional BYOP (Bring Your Own Pollen) key for priority access

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Express.js + TypeScript
- **AI:** [Pollinations.ai](https://pollinations.ai) (text & image)
- **PDF export:** jsPDF

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Copy `.env.example` to `.env` and set your `APP_URL`:
   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Connecting Pollen (Optional)

Click **Connect Pollen** in the top bar to link your [Pollinations.ai](https://pollinations.ai) account for priority access and higher rate limits. No API key setup needed — it uses OAuth.

## Models Available

### Text (Writing)
| Model ID | Name |
|---|---|
| `grok` | Grok 4.20 |
| `gpt-5.4-mini` | GPT-5.4 Mini |
| `openai-large` | GPT-5.4 |
| `kimi-k2.6` | Moonshot Kimi K2.6 |
| `claude` | Claude Sonnet 4.6 |

### Image (Cover Art)
| Model ID | Name |
|---|---|
| `klein` | FLUX.2 Klein 4B |
| `grok-imagine` | Grok Imagine |
| `gptimage-large` | GPT Image 1.5 |
| `gpt-image-2` | GPT Image 2 |
| `nanobanana-2` | NanoBanana 2 |
