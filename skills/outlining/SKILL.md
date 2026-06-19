---
name: outlining
description: Outline generator agent skill. Translates a high-level book description, genre, language, volumes, and page count into a structured chapter-by-chapter outline.
---

# Outlining Agent Skill

This skill governs the outlining phase of book writing. Given a book idea, genre, language, number of volumes, and target pages per volume, it generates a comprehensive narrative structure.

## Context & Inputs
- `description`: The overall premise or summary of the book series.
- `genre`: The target genre (e.g., Sci-Fi, Mystery, Thriller).
- `language`: The language of the book.
- `volumes`: Number of volumes (default 1).
- `pagesPerVolume`: Target page count per volume (default 150 pages).

## Rules & Constraints
1. **Dynamic Chapters calculation**:
   Calculate the number of chapters per volume by targeting roughly 13.5 pages per chapter. For example, a 150-page volume should have exactly 11 chapters (approx. 2750 to 4000 words per chapter). Minimum chapters per volume is 3.
2. **Structural Consistency**:
   For multiple volumes, each volume must have a distinct narrative arc (e.g., volume 1: exposition & rising action, volume 2: climax & resolution) while maintaining continuity.
3. **JSON Output Schema**:
   The output MUST be a valid JSON object containing:
   - `title`: The overarching series or book title.
   - `volumes`: An array of volume objects, each containing:
     - `volumeNumber`: The index of the volume (1-based).
     - `title`: Title of the volume.
     - `summary`: General summary of this volume's arc.
     - `chapters`: An array of chapter outline objects:
       - `number`: The global chapter number (1-based, continuous across volumes).
       - `title`: Title of the chapter.
       - `summary`: A detailed scene-by-scene summary of the chapter events.
4. **Security & Validation**:
   - Ensure the output contains no executable script injections.
   - Do not include placeholders like "To be continued" or "Chapter details here". Summaries must be concrete and actionable.
