import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Loader2, CheckCircle2, Sparkles, Image as ImageIcon, BookOpen, RefreshCw,
  Edit3, Save, X, ArrowRight, Pause, Play, ChevronRight, MessageSquare, 
  Wand2, FileText, CheckCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/src/lib/utils';

import { Chapter, Book } from '@/src/types';
import { 
  generateOutline, generateCover, generateChapterBeats, draftChapter, 
  humanizeChapter, rewriteChapter 
} from '@/src/lib/pollinations';

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
  authorName?: string;
}

const BACKOFF_SCHEDULE = [1, 3, 15, 60, 300];

export function GeneratingStage({ 
  description, genre, language, modelText, modelImage, volumes, pagesPerVolume, apiKey, onComplete,
  resumeBook, onUpdateProgress, authorName
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
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(-1);
  const [chapterPhase, setChapterPhase] = useState<'beats' | 'draft' | 'humanize' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Auto-advance toggle (default true)
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [isAwaitingApproval, setIsAwaitingApproval] = useState<boolean>(false);

  // Manual editing state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>('');

  // AI refinement state
  const [noteText, setNoteText] = useState<string>('');
  const [isRewriting, setIsRewriting] = useState<boolean>(false);

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
    } else {
      // If resuming, synchronize selectedChapterIndex
      const initialIdx = getInitialChapterIndex();
      if (initialIdx >= 0 && initialIdx < resumeBook.chapters.length) {
        setCurrentChapterIndex(initialIdx);
        setSelectedChapterIndex(initialIdx);
      } else {
        // Book is already completed or index is out of bounds
        setCurrentChapterIndex(resumeBook.chapters.length);
        setSelectedChapterIndex(resumeBook.chapters.length - 1);
      }
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
        isIncomplete: true,
        authorName: authorName || 'AI Writer'
      };

      if (onUpdateProgress) {
        onUpdateProgress(initialBook);
      }

      setCurrentChapterIndex(0);
      setSelectedChapterIndex(0);
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
      if (!isAwaitingApproval) {
        generateNextChapter();
      }
    } else if (step === 'chapters' && currentChapterIndex === chapters.length && chapters.length > 0) {
      // Completed book!
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
        pagesPerVolume: pagesPerVolume,
        authorName: resumeBook?.authorName || authorName || 'AI Writer'
      };
      onComplete(finalBook);
    }
  }, [step, currentChapterIndex, isAwaitingApproval]);

  // Sync selected index with active generating index unless user overrides
  useEffect(() => {
    if (currentChapterIndex >= 0 && currentChapterIndex < chapters.length) {
      setSelectedChapterIndex(currentChapterIndex);
    }
  }, [currentChapterIndex]);

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
      }, (streamedContent) => {
        setChapters(prev => prev.map((c, i) => i === currentChapterIndex 
          ? { ...c, content: streamedContent } 
          : c
        ));
      });

      // 3. Humanizing Phase
      setChapterPhase('humanize');
      const refinedContent = await humanizeChapter({
        draftContent: draft.content,
        genre,
        language,
        model: modelText,
        apiKey
      }, (streamedContent) => {
        setChapters(prev => prev.map((c, i) => i === currentChapterIndex 
          ? { ...c, content: streamedContent } 
          : c
        ));
      });

      retryAttemptRef.current = 0; // reset backoff on success
      const updatedChapters = chapters.map((c, i) => i === currentChapterIndex
        ? { ...c, content: refinedContent, isGenerating: false }
        : c
      );
      setChapters(updatedChapters);
      setChapterPhase(null);

      const updatedBook: Book = {
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
        isIncomplete: true,
        authorName: resumeBook?.authorName || authorName || 'AI Writer'
      };

      if (onUpdateProgress) {
        onUpdateProgress(updatedBook);
      }

      if (autoAdvance) {
        setCurrentChapterIndex(prev => prev + 1);
      } else {
        setIsAwaitingApproval(true);
      }
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

  const handleAcceptChapter = () => {
    setIsAwaitingApproval(false);
    setCurrentChapterIndex(prev => prev + 1);
  };

  // Direct manual edit handlers
  const handleStartEdit = () => {
    if (selectedChapterIndex < 0) return;
    setEditText(chapters[selectedChapterIndex].content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (selectedChapterIndex < 0) return;
    const updatedChapters = chapters.map((c, i) => i === selectedChapterIndex
      ? { ...c, content: editText }
      : c
    );
    setChapters(updatedChapters);
    setIsEditing(false);

    const updatedBook: Book = {
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
      isIncomplete: true,
      authorName: resumeBook?.authorName || authorName || 'AI Writer'
    };
    if (onUpdateProgress) {
      onUpdateProgress(updatedBook);
    }
  };

  // AI Refinement / Rewrite handler
  const handleRewrite = async () => {
    if (selectedChapterIndex < 0 || !noteText.trim()) return;
    setIsRewriting(true);
    setError(null);
    const targetIdx = selectedChapterIndex;
    const ch = chapters[targetIdx];

    try {
      const rewrittenContent = await rewriteChapter({
        bookDescription: description,
        genre,
        language,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        chapterSummary: ch.summary,
        currentContent: ch.content,
        instruction: noteText,
        model: modelText,
        apiKey
      }, (streamedContent) => {
        setChapters(prev => prev.map((c, i) => i === targetIdx 
          ? { ...c, content: streamedContent } 
          : c
        ));
      });

      const updatedChapters = chapters.map((c, i) => i === targetIdx
        ? { ...c, content: rewrittenContent }
        : c
      );
      setChapters(updatedChapters);
      setNoteText('');

      const updatedBook: Book = {
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
        isIncomplete: true,
        authorName: resumeBook?.authorName || authorName || 'AI Writer'
      };
      if (onUpdateProgress) {
        onUpdateProgress(updatedBook);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to rewrite Chapter ${ch.number}.`);
    } finally {
      setIsRewriting(false);
    }
  };

  const progress = chapters.length > 0
    ? ((currentChapterIndex + (isAwaitingApproval ? 0 : 0.5)) / (chapters.length + 0.5)) * 100
    : 0;

  const formatCountdown = (sec: number) => {
    if (sec >= 60) return `${Math.ceil(sec / 60)}m`;
    return `${sec}s`;
  };

  const activeChapter = chapters[selectedChapterIndex];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR: Chapter list and status */}
      <aside className="w-80 border-r border-zinc-900 bg-zinc-950 flex flex-col shrink-0">
        
        {/* Sidebar Header */}
        <div className="p-6 border-b border-zinc-900">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Inkwell Creator Studio</span>
          </div>
          
          <h2 className="text-xl font-bold font-serif truncate text-zinc-100" title={title || "Generating Outline..."}>
            {title || "Architecting Novel..."}
          </h2>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-medium">
              <span>Overall Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Structure</span>
            
            {/* Outline Step */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all border",
              step === 'outline' 
                ? "bg-zinc-900/80 border-zinc-800 text-zinc-200" 
                : "border-transparent text-zinc-500"
            )}>
              {step !== 'outline' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
              )}
              <span className="text-sm font-medium">Story Outline Planning</span>
            </div>

            {/* Cover Step */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all border",
              step === 'cover' 
                ? "bg-zinc-900/80 border-zinc-800 text-zinc-200" 
                : step === 'outline'
                  ? "border-transparent text-zinc-700"
                  : "border-transparent text-zinc-500"
            )}>
              {step === 'chapters' ? (
                <div className="flex items-center gap-3 w-full justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium">Cover Art Painting</span>
                  </div>
                  {coverUrl && (
                    <div className="w-7 h-9 rounded bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 shadow">
                      <img src={coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              ) : step === 'cover' ? (
                <>
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                  <span className="text-sm font-medium">Cover Art Painting</span>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded-full border border-zinc-800 shrink-0" />
                  <span className="text-sm font-medium">Cover Art Painting</span>
                </>
              )}
            </div>
          </div>

          {/* Chapters list */}
          {chapters.length > 0 && (
            <div className="space-y-1 pt-2">
              <span className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Chapters</span>
              
              {chapters.map((ch, idx) => {
                const isGenerating = idx === currentChapterIndex && step === 'chapters' && !isAwaitingApproval && !isRewriting;
                const isAwaiting = idx === currentChapterIndex && isAwaitingApproval;
                const isCurrent = idx === currentChapterIndex;
                const isDone = idx < currentChapterIndex || (isCurrent && ch.content && !isGenerating && !isAwaiting);
                const isPending = idx > currentChapterIndex;
                const isSelected = idx === selectedChapterIndex;

                return (
                  <button
                    key={idx}
                    disabled={isPending}
                    onClick={() => {
                      setSelectedChapterIndex(idx);
                      setIsEditing(false);
                    }}
                    className={cn(
                      "w-full text-left p-3 rounded-xl transition-all border flex items-start gap-3 group relative overflow-hidden",
                      isSelected 
                        ? "bg-zinc-900 border-zinc-800 text-zinc-100 shadow-md" 
                        : isPending
                          ? "opacity-45 cursor-not-allowed border-transparent text-zinc-600"
                          : "border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                    )}
                  >
                    {/* Status Icon */}
                    <div className="mt-0.5 shrink-0">
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      ) : isAwaiting ? (
                        <span className="relative flex h-2 w-2 m-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                      ) : isDone ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 animate-scale" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-zinc-800" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs flex items-center gap-1.5">
                        <span>Chapter {ch.number}</span>
                        {isAwaiting && (
                          <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.2 rounded-full font-mono uppercase tracking-wider border border-amber-500/20">
                            Awaiting Accept
                          </span>
                        )}
                        {isGenerating && (
                          <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.2 rounded-full font-mono uppercase tracking-wider border border-blue-500/20 animate-pulse">
                            Generating
                          </span>
                        )}
                      </div>
                      <div className="text-xs truncate font-medium mt-0.5">{ch.title || `Chapter Outline`}</div>
                      <div className="text-[10px] text-zinc-500 truncate mt-0.5 line-clamp-1">{ch.summary}</div>
                    </div>

                    {/* Active highlight decoration */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 to-indigo-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-900 space-y-3">
          <div className="flex items-center justify-between p-3 bg-zinc-900/40 border border-zinc-900 rounded-xl">
            <div className="min-w-0 pr-2">
              <span className="text-xs font-semibold text-zinc-300 block">Auto-Advance</span>
              <span className="text-[10px] text-zinc-500 block leading-tight truncate">Generate chapters sequentially</span>
            </div>
            
            <button
              onClick={() => setAutoAdvance(prev => !prev)}
              className={cn(
                "w-10 h-6 rounded-full p-0.5 transition-colors relative shrink-0",
                autoAdvance ? "bg-blue-600" : "bg-zinc-800"
              )}
            >
              <div 
                className={cn(
                  "w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                  autoAdvance ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {step === 'chapters' && currentChapterIndex === chapters.length && (
            <button
              onClick={() => {
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
                  pagesPerVolume: pagesPerVolume,
                  authorName: resumeBook?.authorName || authorName || 'AI Writer'
                };
                onComplete(finalBook);
              }}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 font-bold rounded-xl flex items-center justify-center gap-2 text-sm text-white transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
            >
              Finish Book & Read <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto relative bg-zinc-950/80 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/60 via-zinc-950 to-zinc-950 flex flex-col h-full">
        
        {/* Banner if viewing past chapter while generating */}
        {step === 'chapters' && selectedChapterIndex !== currentChapterIndex && currentChapterIndex < chapters.length && (
          <div className="bg-blue-950/40 border-b border-blue-900/40 px-6 py-2.5 flex items-center justify-between text-xs text-blue-300">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              Viewing Chapter {selectedChapterIndex + 1}. Chapter {currentChapterIndex + 1} is currently generating.
            </span>
            <button
              onClick={() => {
                setSelectedChapterIndex(currentChapterIndex);
                setIsEditing(false);
              }}
              className="px-3 py-1 bg-blue-500/25 hover:bg-blue-500/35 border border-blue-500/45 rounded-lg font-semibold transition-colors"
            >
              View Active Generation
            </button>
          </div>
        )}

        {/* TOP STATUS MESSAGES / ERROR BANNER */}
        {error && (
          <div className="p-4 bg-red-950/30 border-b border-red-900 text-red-400 text-sm">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
              <span className="text-left font-medium">
                {error}{' '}
                {countdown !== null && (
                  <span className="text-red-300 font-mono">
                    Retrying in {formatCountdown(countdown)}...
                  </span>
                )}
              </span>
              <button
                onClick={handleManualRetry}
                className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 rounded-lg text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry now
              </button>
            </div>
          </div>
        )}

        {/* DYNAMIC VIEWPORTS */}
        <div className="flex-1 overflow-y-auto">
          
          {/* STEP 1: Outline Planning */}
          {step === 'outline' && (
            <div className="h-full flex flex-col items-center justify-center p-8 max-w-lg mx-auto text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
                  <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
                </div>
                <div className="absolute inset-0 w-16 h-16 rounded-full border border-blue-500/30 border-t-transparent animate-spin" />
              </div>
              <h3 className="text-2xl font-bold font-serif mb-2">Architecting the Universe</h3>
              <p className="text-sm text-zinc-400 mb-6">
                Analyzing genre conventions and structuring narrative arcs, character beats, and dynamic chapter pages.
              </p>
              <div className="w-48 h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 animate-pulse w-full" />
              </div>
            </div>
          )}

          {/* STEP 2: Cover Art Painting */}
          {step === 'cover' && (
            <div className="h-full flex flex-col items-center justify-center p-8 max-w-lg mx-auto text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30">
                  <ImageIcon className="w-8 h-8 text-indigo-400 animate-pulse" />
                </div>
                <div className="absolute inset-0 w-16 h-16 rounded-full border border-indigo-500/30 border-t-transparent animate-spin" />
              </div>
              <h3 className="text-2xl font-bold font-serif mb-2">Painting Cover Masterpiece</h3>
              <p className="text-sm text-zinc-400 mb-6">
                Synthesizing book context and genres to design a high-quality, professional-grade cover illustration.
              </p>
              <div className="w-48 h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 animate-pulse w-full" />
              </div>
            </div>
          )}

          {/* STEP 3: Chapter Generation View */}
          {step === 'chapters' && activeChapter && (
            <div className="max-w-3xl mx-auto px-8 py-12 space-y-8">
              
              {/* Chapter Title & Header */}
              <div className="border-b border-zinc-900 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-amber-500/80 font-mono text-xs tracking-widest uppercase">
                    Chapter {activeChapter.number} of {chapters.length}
                  </span>
                  <h1 className="text-3xl font-bold font-serif text-zinc-100">
                    {activeChapter.title || "Untitled Chapter"}
                  </h1>
                  <p className="text-sm text-zinc-500 italic mt-1 leading-relaxed">
                    {activeChapter.summary}
                  </p>
                </div>

                {/* Chapter Meta status & Controls */}
                <div className="shrink-0 flex items-center gap-2">
                  
                  {/* Status Badge */}
                  {selectedChapterIndex === currentChapterIndex && (
                    <>
                      {isGeneratingStageActive(chapterPhase) && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{chapterPhase === 'beats' ? 'Outlining Beats' : chapterPhase === 'draft' ? 'Drafting Prose' : 'Humanizing'}</span>
                        </div>
                      )}
                      {isAwaitingApproval && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-lg text-xs font-semibold animate-pulse">
                          <Pause className="w-3.5 h-3.5" />
                          <span>Awaiting Approval</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Manual Edit Button */}
                  {!isEditing && activeChapter.content && !isRewriting && (
                    <button
                      onClick={handleStartEdit}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-zinc-300 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Live Chapter State (outline beats/draft/humanize steps list) */}
              {selectedChapterIndex === currentChapterIndex && chapterPhase && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-zinc-900/30 border border-zinc-900/60 rounded-2xl max-w-xl mx-auto">
                  <div className="flex items-center gap-2 justify-center">
                    <div className={cn("w-2 h-2 rounded-full", chapterPhase === 'beats' ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-zinc-700")} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", chapterPhase === 'beats' ? "text-amber-400" : "text-zinc-500")}>1. Beats</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <div className={cn("w-2 h-2 rounded-full", chapterPhase === 'draft' ? "bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-zinc-700")} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", chapterPhase === 'draft' ? "text-blue-400" : "text-zinc-500")}>2. Drafting</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <div className={cn("w-2 h-2 rounded-full", chapterPhase === 'humanize' ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-700")} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", chapterPhase === 'humanize' ? "text-emerald-400" : "text-zinc-500")}>3. Humanize</span>
                  </div>
                </div>
              )}

              {/* Text / Markdown Editor View */}
              <div className="min-h-[200px]">
                {isEditing ? (
                  <div className="space-y-4">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full h-[55vh] p-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl focus:border-blue-500/80 outline-none font-mono text-sm leading-relaxed text-zinc-200 resize-none shadow-inner"
                      placeholder="Write your prose here..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 flex items-center gap-1.5 transition-colors"
                      >
                        <X className="w-4 h-4" /> Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                      >
                        <Save className="w-4 h-4" /> Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-amber max-w-none prose-lg font-serif leading-relaxed text-zinc-300">
                    {activeChapter.content ? (
                      <ReactMarkdown>
                        {activeChapter.content + (isStreamingText(selectedChapterIndex, currentChapterIndex, chapterPhase, isRewriting) ? " █" : "")}
                      </ReactMarkdown>
                    ) : (
                      <div className="py-20 text-center text-zinc-600 border border-dashed border-zinc-900 rounded-3xl flex flex-col items-center gap-3">
                        <FileText className="w-8 h-8 text-zinc-800" />
                        <span>Chapter is awaiting generation...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Accept & Continue Box (if manual approval active) */}
              {selectedChapterIndex === currentChapterIndex && isAwaitingApproval && !isEditing && (
                <div className="p-6 bg-zinc-900/30 border border-zinc-900 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
                  <div className="space-y-1 text-center md:text-left">
                    <h4 className="font-bold text-sm text-zinc-200">Review Complete</h4>
                    <p className="text-xs text-zinc-500">You can edit or rewrite this chapter, or accept it to begin the next one.</p>
                  </div>
                  <button
                    onClick={handleAcceptChapter}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 font-bold rounded-xl flex items-center gap-2 text-sm text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-all shrink-0 hover:scale-[1.02]"
                  >
                    Accept & Continue <ArrowRight className="w-4.5 h-4.5" />
                  </button>
                </div>
              )}

              {/* REWRITE WITH NOTE PANEL (only if chapter has content and is not currently rewriting/generating) */}
              {activeChapter.content && !isEditing && (
                <div className="border-t border-zinc-900 pt-8 mt-12">
                  <div className="bg-zinc-900/20 border border-zinc-900 p-6 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-purple-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Refine with AI Instructions</h4>
                    </div>

                    <div className="flex gap-2">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        disabled={isRewriting || (selectedChapterIndex === currentChapterIndex && isGeneratingStageActive(chapterPhase))}
                        placeholder="Type instruction (e.g. 'Add more suspense to the ending', 'Make it sound more poetic')"
                        rows={2}
                        className="flex-1 p-3 bg-zinc-950 border border-zinc-900 focus:border-purple-500/80 rounded-xl outline-none text-xs text-zinc-300 placeholder-zinc-600 resize-none font-medium"
                      />
                      
                      <button
                        onClick={handleRewrite}
                        disabled={isRewriting || !noteText.trim() || (selectedChapterIndex === currentChapterIndex && isGeneratingStageActive(chapterPhase))}
                        className="px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_12px_rgba(147,51,234,0.2)] shrink-0 h-auto"
                      >
                        {isRewriting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4" />
                        )}
                        Rewrite
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </main>

    </div>
  );
}

// Helpers
function isGeneratingStageActive(phase: string | null): boolean {
  return phase === 'beats' || phase === 'draft' || phase === 'humanize';
}

function isStreamingText(selectedIdx: number, currentIdx: number, phase: string | null, isRewriting: boolean): boolean {
  if (isRewriting && selectedIdx === currentIdx) return true;
  return selectedIdx === currentIdx && (phase === 'draft' || phase === 'humanize');
}
