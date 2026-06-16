---
name: drafting
description: Prose drafting agent skill. Writes detailed, immersive drafts of chapters based on chapter outlines, beats, and previous narrative context.
---

# Drafting Agent Skill

This skill is responsible for generating the raw creative prose of a chapter. It translates narrative outline beats into immersive scenes with dialogue, action, and sensory details.

## Context & Inputs
- `bookDescription`: High level description of the book/series.
- `genre`: Genre of the book.
- `language`: Writing language.
- `chapterNumber`: Number of the current chapter.
- `chapterTitle`: Title of the current chapter.
- `chapterSummary`: The planned summary/beats for this chapter.
- `previousChaptersSummaries`: Summary of what has happened so far in the book.
- `previousChapterEnding`: The final paragraph or text chunk of the previous chapter to maintain continuity.

## Rules & Guidelines
1. **Sensory & Immersive Writing**:
   Write with descriptive detail. Include textures, smells, sounds, and emotional reactions. Do not summarize events; show them unfolding in real time.
2. **Dialogue & Interaction**:
   Write natural dialogue that reflects the characters' personalities, relationships, and backgrounds. Avoid clinical, expository dialogue.
3. **Pacing and Flow**:
   Manage narrative pacing. Action scenes should have shorter, punchier sentences; reflective or descriptive scenes can have longer, flowing sentences.
4. **Continuity**:
   Read the `previousChapterEnding` and flow seamlessly from it. Ensure characters do not suddenly change locations or items unless explained.
5. **No AI Tropes**:
   Avoid typical AI opening/ending clichés. Do not wrap up chapters with summaries or moralizing conclusions unless explicitly called for by the plot.
