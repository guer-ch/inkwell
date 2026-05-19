import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, FileText, ChevronLeft, Search, Menu, 
  RefreshCw, Maximize2, Zap, MessageSquare, DownloadCloud, Loader2
} from 'lucide-react';
import { Book, Chapter } from '@/src/types';
import { cn } from '@/src/lib/utils';
import axios from 'axios';

interface BookReaderProps {
  book: Book;
  apiKey?: string;
  onBack: () => void;
  onUpdateBook: (book: Book) => void;
}

export function BookReader({ book, apiKey, onBack, onUpdateBook }: BookReaderProps) {
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleExportPDF = async () => {
    try {
      const response = await axios.post('/api/export/pdf', {
        title: book.title,
        chapters: book.chapters,
        coverUrl: book.coverUrl
      }, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${book.title}.pdf`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportMarkdown = async () => {
    try {
      const response = await axios.post('/api/export/markdown', {
        title: book.title,
        chapters: book.chapters
      }, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${book.title}.md`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerateChapter = async (instr: string) => {
    const chIndex = selectedChapter - 1;
    const ch = book.chapters[chIndex];
    setIsRegenerating(true);

    try {
      const prompt = `
        Refine the following chapter of a ${book.genre} book in ${book.language}.
        Instruction: ${instr}
        
        Original Content:
        ${ch.content}
        
        Provide only the new chapter content.
      `;

      // Using the generic generateText endpoint indirectly? 
      // Actually let's just make a small endpoint or use a direct call if we could.
      // For simplicity, let's use a proxy if needed, but here I'll just reuse generate-chapter with special flags or just refine.
      // Let's assume generate-chapter can handle it if we passed it in, but I'll call a dedicated-ish prompt.
      
      // For now, I'll just use the text pollinations directly via server (safe way)
      const res = await axios.post('/api/generate-chapter', {
        book_description: book.description,
        genre: book.genre,
        language: book.language,
        chapter_number: ch.number,
        chapter_title: ch.title,
        chapter_summary: `REFINEMENT: ${instr}. Context: ${ch.summary}`,
        model: book.modelText,
        apiKey
      });

      const newChapters = [...book.chapters];
      newChapters[chIndex] = { ...ch, content: res.data.content };
      onUpdateBook({ ...book, chapters: newChapters });
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const currentChapter = book.chapters.find(c => c.number === selectedChapter) || book.chapters[0];

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Table of Contents Sidebar */}
      <aside className={cn(
        "w-80 border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-xl flex flex-col transition-all duration-300",
        !isSidebarOpen && "-ml-80"
      )}>
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 group"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <span className="font-bold text-sm tracking-widest uppercase text-zinc-500">Contents</span>
          <div className="w-9" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {book.chapters.map((ch) => (
            <button
              key={ch.number}
              onClick={() => setSelectedChapter(ch.number)}
              className={cn(
                "w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 group",
                selectedChapter === ch.number 
                  ? "bg-white text-black shadow-lg" 
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
            >
              <span className={cn(
                "text-xs font-bold w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                selectedChapter === ch.number ? "bg-black/10" : "bg-zinc-800"
              )}>
                {ch.number}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{ch.title}</div>
                <div className={cn(
                  "text-[10px] line-clamp-1",
                  selectedChapter === ch.number ? "text-black/60" : "text-zinc-500"
                )}>{ch.summary}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-6 border-t border-zinc-800 space-y-3">
          <button 
            onClick={handleExportPDF}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
          >
            <DownloadCloud className="w-4 h-4" /> Export PDF
          </button>
          <button 
            onClick={handleExportMarkdown}
            className="w-full py-3 bg-zinc-950/50 hover:bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" /> Export Markdown
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-zinc-950">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={cn(
            "fixed bottom-6 left-6 z-50 p-4 bg-white text-black rounded-full shadow-2xl hover:scale-110 transition-all",
            isSidebarOpen && "left-86"
          )}
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Hero Cover */}
        <div className="relative h-[60vh] w-full bg-zinc-900 mb-20 overflow-hidden">
          <img 
            src={book.coverUrl} 
            alt={book.title}
            className="w-full h-full object-cover opacity-40 blur-lg scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
          
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-20 px-6 max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative w-[300px] aspect-[3/4] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] rounded-lg overflow-hidden border border-zinc-800/50"
            >
              <img 
                src={book.coverUrl} 
                alt="Book Cover"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center mt-8 space-y-2"
            >
              <h1 className="text-5xl font-bold font-serif italic tracking-tight">{book.title}</h1>
              <p className="text-zinc-500 uppercase tracking-widest text-sm font-sans underline decoration-amber-500/50 underline-offset-8">
                {book.genre} • {book.language} 
              </p>
            </motion.div>
          </div>
        </div>

        {/* Chapter Content */}
        <div className="max-w-2xl mx-auto px-6 pb-40">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedChapter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="book-content"
            >
              <div className="mb-12 text-center">
                <span className="text-amber-500/80 font-mono text-sm tracking-widest uppercase mb-4 block">Chapter {currentChapter.number}</span>
                <h2 className="text-4xl font-bold font-serif mb-8">{currentChapter.title}</h2>
                <div className="w-24 h-px bg-zinc-800 mx-auto" />
              </div>
              
              <div className="prose prose-invert prose-amber max-w-none prose-lg">
                <ReactMarkdown>{currentChapter.content}</ReactMarkdown>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Action Sidebar (Collapsible) */}
      <aside className="w-80 border-l border-zinc-800 bg-zinc-900/30 p-6 space-y-8 overflow-y-auto hidden xl:block">
        <div>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" /> Options
          </h3>
          <div className="grid grid-cols-1 gap-3">
             {[
               { id: 'longer', icon: Maximize2, label: 'Make it longer' },
               { id: 'tone', icon: RefreshCw, label: 'Change tone' },
               { id: 'summ', icon: MessageSquare, label: 'Summarize' },
               { id: 'rewr', icon: RefreshCw, label: 'Rewrite entirely' }
             ].map((opt) => (
               <button 
                 key={opt.id}
                 disabled={isRegenerating}
                 onClick={() => handleRegenerateChapter(opt.label)}
                 className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors disabled:opacity-50"
               >
                 <opt.icon className="w-4 h-4 text-zinc-400" />
                 <span className="text-sm font-medium">{opt.label}</span>
               </button>
             ))}
          </div>
        </div>

        {isRegenerating && (
          <div className="flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-2xl border border-blue-500/20 gap-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-zinc-400 text-center">AI is working its magic...</p>
          </div>
        )}

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800">
           <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Metadata</h4>
           <div className="space-y-4">
              <div>
                <span className="text-[10px] text-zinc-500 block">Description</span>
                <p className="text-xs text-zinc-400 line-clamp-4 mt-1 leading-relaxed">{book.description}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block">AI Writer</span>
                <p className="text-xs text-zinc-400 mt-1">{book.modelText}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block">Created</span>
                <p className="text-xs text-zinc-400 mt-1">{new Date(book.createdAt).toLocaleDateString()}</p>
              </div>
           </div>
        </div>
      </aside>
    </div>
  );
}
