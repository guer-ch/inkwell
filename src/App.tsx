import React, { useState, useEffect } from 'react';
import { BookForm } from './components/book/BookForm';
import { GeneratingStage } from './components/book/GeneratingStage';
import { BookReader } from './components/book/BookReader';
import { AppStage, Book } from './types';
import { Library, Plus, ChevronRight, BookOpen, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Hardcode your Pollinations public key here
const POLLINATIONS_PUBLIC_KEY: string = "pk_gf18IFswDRED1XSZ";

export default function App() {
  const [stage, setStage] = useState<AppStage>('setup');
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pollinationsKey, setPollinationsKey] = useState<string>(localStorage.getItem('pollinations_key') || '');
  const [formData, setFormData] = useState<{
    description: string;
    genre: string;
    language: string;
    modelText: string;
    modelImage: string;
    volumes: number;
    pagesPerVolume: number;
  } | null>(null);


  // Effective key: user-connected Pollen takes priority, otherwise fall back to the public key
  const effectiveApiKey = pollinationsKey || POLLINATIONS_PUBLIC_KEY;

  // Load books and handle Pollinations redirect
  useEffect(() => {
    const saved = localStorage.getItem('inkwell_books');
    if (saved) {
      try {
        setAllBooks(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved books', e);
      }
    }

    // Handle Pollinations BYOP redirect (api_key=... in URL fragment or search query)
    const hash = window.location.hash;
    const search = window.location.search;
    let token = '';

    if (hash.includes('api_key=') || hash.includes('pollen_token=')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      token = params.get('api_key') || params.get('pollen_token') || '';
    } else if (search.includes('api_key=') || search.includes('pollen_token=')) {
      const params = new URLSearchParams(search);
      token = params.get('api_key') || params.get('pollen_token') || '';
    }

    if (token) {
      setPollinationsKey(token);
      localStorage.setItem('pollinations_key', token);
      // Clean the URL
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleConnect = () => {
    const params = new URLSearchParams({
      client_id: POLLINATIONS_PUBLIC_KEY,
      redirect_uri: window.location.origin + window.location.pathname
    });

    window.location.href = `https://enter.pollinations.ai/authorize?${params}`;
  };

  // Save books to localStorage
  useEffect(() => {
    localStorage.setItem('inkwell_books', JSON.stringify(allBooks));
  }, [allBooks]);

  const handleStartGeneration = (data: any) => {
    setFormData(data);
    setStage('generating');
  };

  const handleGenerationComplete = (book: Book) => {
    setCurrentBook(book);
    setAllBooks(prev => [book, ...prev]);
    setStage('reader');
  };

  const handleSelectBook = (book: Book) => {
    setCurrentBook(book);
    setStage('reader');
    setIsDrawerOpen(false);
  };

  const handleDeleteBook = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAllBooks(prev => prev.filter(b => b.id !== id));
    if (currentBook?.id === id) {
      setStage('setup');
      setCurrentBook(null);
    }
  };

  const updateBook = (book: Book) => {
    setCurrentBook(book);
    setAllBooks(prev => prev.map(b => b.id === book.id ? book : b));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-blue-500/30">
      {/* Top Left: Actions */}
      <div className="fixed top-6 left-6 z-[60] flex gap-3">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all flex items-center gap-2 group"
        >
          <Library className="w-5 h-5 text-zinc-400 group-hover:text-blue-400" />
          <span className="text-sm font-medium">My Library</span>
        </button>

        {stage !== 'setup' && stage !== 'generating' && (
          <button
            onClick={() => {
              setStage('setup');
              setCurrentBook(null);
            }}
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all group"
            title="Create New Book"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={handleConnect}
          className={cn(
            "px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 group whitespace-nowrap",
            pollinationsKey ? "bg-blue-500/10 border-blue-500/50 text-blue-400" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
          )}
        >
          <div className={cn("w-2 h-2 rounded-full", pollinationsKey ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-zinc-700")} />
          <span className="text-sm font-medium">
            {pollinationsKey ? 'Pollen Connected' : 'Connect Pollen'}
          </span>
        </button>
      </div>

      {/* Top Right: Branding */}
      <div className="fixed top-6 right-6 z-[60] flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
          <span>Powered by</span>
          <a href="https://pollinations.ai" target="_blank" className="text-zinc-500 hover:text-blue-500 transition-colors">Pollinations.ai</a>
        </div>
      </div>

      {/* Library Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 h-full w-[400px] bg-zinc-900 border-l border-zinc-800 z-[80] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Library className="w-6 h-6 text-blue-500" /> Library
                </h2>
                <button onClick={() => setIsDrawerOpen(false)} className="text-zinc-500 hover:text-white">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-160px)] pr-2">
                {allBooks.length === 0 ? (
                  <div className="text-center py-20 bg-zinc-950/50 rounded-3xl border border-dashed border-zinc-800">
                    <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500 text-sm">Your library is empty.</p>
                  </div>
                ) : (
                  allBooks.map(book => (
                    <div
                      key={book.id}
                      onClick={() => handleSelectBook(book)}
                      className="group relative flex gap-4 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800 hover:border-zinc-600 transition-all cursor-pointer overflow-hidden"
                    >
                      <div className="w-16 h-20 shrink-0 rounded-lg overflow-hidden border border-zinc-800 shadow-lg">
                        <img src={book.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <h3 className="font-bold text-sm truncate">{book.title}</h3>
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{book.description}</p>
                        <span className="inline-block mt-2 text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
                          {book.genre}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteBook(book.id, e)}
                        className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => {
                  setStage('setup');
                  setCurrentBook(null);
                  setIsDrawerOpen(false);
                }}
                className="absolute bottom-8 left-8 right-8 py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
              >
                <Plus className="w-5 h-5" /> Start New Project
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main>
        {stage === 'setup' && (
          <BookForm onGenerate={handleStartGeneration} />
        )}

        {stage === 'generating' && formData && (
          <GeneratingStage
            {...formData}
            apiKey={effectiveApiKey}
            onComplete={handleGenerationComplete}
          />
        )}

        {stage === 'reader' && currentBook && (
          <BookReader
            book={currentBook}
            apiKey={effectiveApiKey}
            onBack={() => setStage('setup')}
            onUpdateBook={updateBook}
          />
        )}
      </main>
    </div>
  );
}

