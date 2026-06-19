import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, Sparkles, Image as ImageIcon, BookOpen, RefreshCw } from 'lucide-react';
import { cn } from '@/src/lib/utils';

import { Chapter, Book } from '@/src/types';
import { generateOutline, generateCover, generateChapterBeats, draftChapter, humanizeChapter } from '@/src/lib/pollinations';


interface GeneratingStageProps {
  description: string;
  genre: string;
  language: string;
  modelText: string;
  modelImage: string;
  volumes: number;
  pagesPerVolume: number;
  apiKey?: string;
  onComplete: (book: Book) => void;
  resumeBook?: Book | null;
  onUpdateProgress?: (book: Book) => void;
}

// Backoff schedule in seconds: 1, 3, 15, 60, 300, then stays at 300
const BACKOFF_SCHEDULE = [1, 3, 15, 60, 300];

export function GeneratingStage({ 
  description, genre, language, modelText, modelImage, volumes, pagesPerVolume, apiKey, onComplete,
  resumeBook, onUpdateProgress
}: GeneratingStageProps) {
  const [step, setStep] = useState<'outline' | 'cover' | 'chapters'>(
    resumeBook ? 'chapters' : 'outline'
  );
  const [title, setTitle] = useState(resumeBook?.title || '');
  const [coverUrl, setCoverUrl] = useState(resumeBook?.coverUrl || '');
  const [chapters, setChapters] = useState<Chapter[]>(resumeBook?.chapters || []);
  
  const getInitialChapterIndex = () => {
    if (!resumeBook) return -1;
    const idx = resumeBook.chapters.findIndex(c => !c.content);
    return idx !== -1 ? idx : resumeBook.chapters.length;
  };
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(getInitialChapterIndex());
  const [chapterPhase, setChapterPhase] = useState<'beats' | 'draft' | 'humanize' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const bookIdRef = useRef<string>(resumeBook?.id || crypto.randomUUID());


  const retryTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const retryActionRef = useRef<(() => void) | null>(null);
  const retryAttemptRef = useRef<number>(0);

  const clearAll = () => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const scheduleRetry = (fn: () => void) => {
    clearAll();
    retryActionRef.current = fn;

    const attempt = retryAttemptRef.current;
    const delaySec = BACKOFF_SCHEDULE[Math.min(attempt, BACKOFF_SCHEDULE.length - 1)];
    retryAttemptRef.current = attempt + 1;

    // Start countdown display
    setCountdown(delaySec);
    let remaining = delaySec;
    countdownIntervalRef.current = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        window.clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;
      }
    }, 1000);

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setCountdown(null);
      fn();
    }, delaySec * 1000);
  };

  const handleManualRetry = () => {
    const fn = retryActionRef.current;
    if (!fn) return;
    clearAll();
    setCountdown(null);
    setError(null);
    fn();
  };

  useEffect(() => {
    if (!resumeBook) {
      generateBook();
    }
    return () => clearAll();
  }, []);

  const generateBook = async () => {
    try {
      setError(null);
      setCountdown(null);
      retryAttemptRef.current = 0;

      const outline = await generateOutline({
        description, genre, language, model: modelText, volumes, pagesPerVolume, apiKey
      });
      setTitle(outline.title);
      const initialChapters = outline.chapters.map((ch: any) => ({ ...ch, content: '', isGenerating: false }));
      setChapters(initialChapters);
      setStep('cover');

      const cover = await generateCover({
        title: outline.title, genre, description, model: modelImage, apiKey
      });
      setCoverUrl(cover.imageUrl);
      setStep('chapters');

      const initialBook: Book = {
        id: bookIdRef.current,
        title: outline.title,
        description,
        genre,
        language,
        coverUrl: cover.imageUrl,
        chapters: initialChapters,
        createdAt: new Date().toISOString(),
        modelText,
        modelImage,
        volumesCount: volumes,
        pagesPerVolume: pagesPerVolume,
        isIncomplete: true
      };

      if (onUpdateProgress) {
        onUpdateProgress(initialBook);
      }

      setCurrentChapterIndex(0);
    } catch (err: any) {
      console.error(err);
      const isPaymentRequired = err?.message?.includes('402') || err?.message?.includes('Payment Required');
      if (isPaymentRequired) {
        setError('Payment Required (402): Your Pollinations AI key has insufficient funds or quota. Please connect a funded key.');
      } else {
        setError('Failed to start book generation.');
      }
      scheduleRetry(generateBook);
    }
  };

  useEffect(() => {
    if (step === 'chapters' && currentChapterIndex >= 0 && currentChapterIndex < chapters.length) {
      generateNextChapter();
    } else if (step === 'chapters' && currentChapterIndex === chapters.length && chapters.length > 0) {
      const finalBook: Book = {
        id: bookIdRef.current,
        title,
        description,
        genre,
        language,
        coverUrl,
        chapters,
        createdAt: resumeBook?.createdAt || new Date().toISOString(),
        modelText,
        modelImage,
        volumesCount: volumes,
        pagesPerVolume: pagesPerVolume
      };
      onComplete(finalBook);
    }
  }, [step, currentChapterIndex]);

  const generateNextChapter = async () => {
    try {
      setError(null);
      setCountdown(null);

      const ch = chapters[currentChapterIndex];
      const prevSummaries = chapters
        .slice(Math.max(0, currentChapterIndex - 2), currentChapterIndex)
        .map(c => `Chapter ${c.number}: ${c.summary}`)
        .join('\n');
      const prevChapterEnd = currentChapterIndex > 0
        ? chapters[currentChapterIndex - 1].content.slice(-500)
        : '';

      setChapters(prev => prev.map((c, i) => i === currentChapterIndex ? { ...c, isGenerating: true } : c));

      // 1. Beats Phase
      setChapterPhase('beats');
      const beats = await generateChapterBeats({
        bookDescription: description,
        genre,
        language,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        chapterSummary: ch.summary,
        volumeNumber: ch.volumeNumber,
        previousChaptersSummaries: prevSummaries,
        model: modelText,
        apiKey
      });

      // 2. Drafting Phase
      setChapterPhase('draft');
      const draft = await draftChapter({
        bookDescription: description,
        genre,
        language,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        chapterSummary: ch.summary,
        chapterBeats: beats,
        previousChaptersSummaries: prevSummaries,
        previousChapterEnding: prevChapterEnd,
        model: modelText,
        apiKey,
        targetPages: ch.targetPages
      });

      // 3. Humanizing Phase
      setChapterPhase('humanize');
      const refinedContent = await humanizeChapter({
        draftContent: draft.content,
        genre,
        language,
        model: modelText,
        apiKey
      });

      retryAttemptRef.current = 0; // reset backoff on success
      const updatedChapters = chapters.map((c, i) => i === currentChapterIndex
        ? { ...c, content: refinedContent, isGenerating: false }
        : c
      );
      setChapters(updatedChapters);
      setChapterPhase(null);

      if (onUpdateProgress) {
        onUpdateProgress({
          id: bookIdRef.current,
          title,
          description,
          genre,
          language,
          coverUrl,
          chapters: updatedChapters,
          createdAt: resumeBook?.createdAt || new Date().toISOString(),
          modelText,
          modelImage,
          volumesCount: volumes,
          pagesPerVolume: pagesPerVolume,
          isIncomplete: true
        });
      }

      setCurrentChapterIndex(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      const isPaymentRequired = err?.message?.includes('402') || err?.message?.includes('Payment Required');
      if (isPaymentRequired) {
        setError('Payment Required (402): Your Pollinations AI key has insufficient funds or quota. Please connect a funded key.');
      } else {
        setError(`Failed to generate Chapter ${currentChapterIndex + 1}.`);
      }
      scheduleRetry(generateNextChapter);
    }
  };


  const progress = chapters.length > 0
    ? ((currentChapterIndex + 1) / (chapters.length + 1)) * 100
    : 0;

  const formatCountdown = (sec: number) => {
    if (sec >= 60) return `${Math.ceil(sec / 60)}m`;
    return `${sec}s`;
  };

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
              <div className="flex items-center justify-between gap-4">
                <span className="text-left">
                  {error}{' '}
                  {countdown !== null && (
                    <span className="text-red-300 font-mono">
                      Retrying in {formatCountdown(countdown)}...
                    </span>
                  )}
                </span>
                <button
                  onClick={handleManualRetry}
                  className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 rounded-lg text-xs font-medium transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry now
                </button>
              </div>
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

            {step === 'chapters' && chapterPhase && (
              <div className="mt-4 flex items-center justify-center gap-6 px-5 py-2.5 bg-zinc-900/45 border border-zinc-800/60 rounded-2xl max-w-md w-full mx-auto backdrop-blur-sm shadow-inner">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", chapterPhase === 'beats' ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-zinc-700")} />
                  <span className={cn("text-xs font-semibold font-mono uppercase tracking-wider", chapterPhase === 'beats' ? "text-amber-400 font-medium" : "text-zinc-500")}>Outline Beats</span>
                </div>
                <div className="w-1.5 h-1.5 bg-zinc-850 rounded-full" />
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", chapterPhase === 'draft' ? "bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-zinc-700")} />
                  <span className={cn("text-xs font-semibold font-mono uppercase tracking-wider", chapterPhase === 'draft' ? "text-blue-400 font-medium" : "text-zinc-500")}>Drafting Prose</span>
                </div>
                <div className="w-1.5 h-1.5 bg-zinc-850 rounded-full" />
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", chapterPhase === 'humanize' ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-700")} />
                  <span className={cn("text-xs font-semibold font-mono uppercase tracking-wider", chapterPhase === 'humanize' ? "text-emerald-400 font-medium" : "text-zinc-500")}>Humanizing</span>
                </div>
              </div>
            )}
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
