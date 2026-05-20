import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, Sparkles, Image as ImageIcon, BookOpen } from 'lucide-react';
import { Chapter, Book } from '@/src/types';
import { generateOutline, generateChapter, generateCover } from '@/src/lib/pollinations';

interface GeneratingStageProps {
  description: string;
  genre: string;
  language: string;
  modelText: string;
  modelImage: string;
  apiKey?: string;
  onComplete: (book: Book) => void;
}

export function GeneratingStage({ 
  description, genre, language, modelText, modelImage, apiKey, onComplete 
}: GeneratingStageProps) {
  const [step, setStep] = useState<'outline' | 'cover' | 'chapters'>('outline');
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateBook();
  }, []);

  const generateBook = async () => {
    try {
      // 1. Generate Outline
      setError(null);
      const outline = await generateOutline({
        description, genre, language, model: modelText, apiKey
      });
      setTitle(outline.title);
      setChapters(outline.chapters.map((ch: any) => ({ ...ch, content: '', isGenerating: false })));
      setStep('cover');

      // 2. Generate Cover
      const cover = await generateCover({
        title: outline.title, genre, description, model: modelImage, apiKey
      });
      setCoverUrl(cover.imageUrl);
      setStep('chapters');
      setCurrentChapterIndex(0);
    } catch (err) {
      setError('Failed to start book generation. Please try again.');
      console.error(err);
    }
  };

  useEffect(() => {
    if (step === 'chapters' && currentChapterIndex >= 0 && currentChapterIndex < chapters.length) {
      generateNextChapter();
    } else if (step === 'chapters' && currentChapterIndex === chapters.length) {
      const finalBook: Book = {
        id: crypto.randomUUID(),
        title,
        description,
        genre,
        language,
        coverUrl,
        chapters,
        createdAt: new Date().toISOString(),
        modelText,
        modelImage
      };
      onComplete(finalBook);
    }
  }, [step, currentChapterIndex]);

  const generateNextChapter = async () => {
    try {
      const ch = chapters[currentChapterIndex];
      const prevSummaries = chapters
        .slice(Math.max(0, currentChapterIndex - 2), currentChapterIndex)
        .map(c => `Chapter ${c.number}: ${c.summary}`)
        .join('\n');
      
      const prevChapterEnd = currentChapterIndex > 0 ? chapters[currentChapterIndex-1].content.slice(-500) : '';

      setChapters(prev => prev.map((c, i) => i === currentChapterIndex ? { ...c, isGenerating: true } : c));

      const result = await generateChapter({
        bookDescription: description,
        genre,
        language,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        chapterSummary: ch.summary,
        previousChaptersSummaries: prevSummaries,
        previousChapterEnding: prevChapterEnd,
        model: modelText,
        apiKey
      });

      setChapters(prev => prev.map((c, i) => i === currentChapterIndex ? { 
        ...c, 
        content: result.content, 
        isGenerating: false 
      } : c));

      setCurrentChapterIndex(prev => prev + 1);
    } catch (err) {
      setError(`Failed to generate Chapter ${currentChapterIndex + 1}. Retrying...`);
      setTimeout(generateNextChapter, 3000);
    }
  };

  const progress = chapters.length > 0 
    ? ((currentChapterIndex + 1) / (chapters.length + 1)) * 100 
    : 0;

  return (
    <div className="max-w-xl mx-auto py-24 px-6 text-center">
      <div className="mb-12 relative h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step + currentChapterIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          {error && (
            <div className="p-4 bg-red-950/30 border border-red-900 rounded-xl text-red-400 text-sm mb-6">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            {step === 'outline' && <Sparkles className="w-12 h-12 text-blue-400 animate-pulse" />}
            {step === 'cover' && <ImageIcon className="w-12 h-12 text-indigo-400 animate-pulse" />}
            {step === 'chapters' && <BookOpen className="w-12 h-12 text-emerald-400 animate-pulse" />}
            
            <h2 className="text-2xl font-bold">
              {step === 'outline' && 'Architecting the story...'}
              {step === 'cover' && 'Painting the cover art...'}
              {step === 'chapters' && `Envisioning Chapter ${currentChapterIndex + 1} of ${chapters.length}...`}
            </h2>
            <p className="text-zinc-400">
              {step === 'outline' && 'Building world structure and character arcs.'}
              {step === 'cover' && `Creating a cinematic visual for ${title || 'your book'}.`}
              {step === 'chapters' && `Writing: "${chapters[currentChapterIndex]?.title}"`}
            </p>
          </div>

          {step === 'chapters' && chapters[currentChapterIndex] && (
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              {chapters.map((ch, i) => (
                <div key={i} className="flex items-center gap-3 text-left">
                  {i < currentChapterIndex ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : i === currentChapterIndex ? (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-zinc-700" />
                  )}
                  <span className={`text-sm ${i === currentChapterIndex ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}>
                    Chapter {ch.number}: {ch.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
