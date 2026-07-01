import React, { useState, useEffect } from 'react';
import { BookForm } from './components/book/BookForm';
import { GeneratingStage } from './components/book/GeneratingStage';
import { BookReader } from './components/book/BookReader';
import { AppStage, Book } from './types';
import { Library, Plus, BookOpen, Trash2, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Hardcode your Pollinations public key here
const POLLINATIONS_PUBLIC_KEY: string = "pk_gf18IFswDRED1XSZ";

const TEXT_MODELS = [
  { id: 'grok4.3', name: 'Grok 4.3' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' },
  { id: 'openai-large', name: 'GPT-5.4' },
  { id: 'kimi-k2.6', name: 'Moonshot Kimi K2.6' },
  { id: 'claude', name: 'Claude Sonnet 4.6' },
  { id: 'gpt-5.5', name: 'GPT-5.5' }
];

const IMAGE_MODELS = [
  { id: 'zimage', name: 'z-image turbo' },
  { id: 'grok-imagine', name: 'Grok Imagine' },
  { id: 'gptimage-large', name: 'GPT Image 1.5' },
  { id: 'qwen-image', name: 'Qwen image plus' },
  { id: 'gpt-image-2', name: 'GPT Image 2' },
  { id: 'nanobanana-2', name: 'NanoBanana 2' }
];

export default function App() {
  const [allBooks, setAllBooks] = useState<Book[]>(() => {
    const saved = localStorage.getItem('inkwell_books');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved books', e);
      }
    }
    return [];
  });

  const [stage, setStage] = useState<AppStage>(() => {
    const savedStage = localStorage.getItem('inkwell_stage') as AppStage | null;
    const savedCurrentBookId = localStorage.getItem('inkwell_current_book_id');
    if (savedStage === 'generating' && !savedCurrentBookId) {
      return 'setup';
    }
    return savedStage || 'setup';
  });

  const [currentBook, setCurrentBook] = useState<Book | null>(() => {
    const savedCurrentBookId = localStorage.getItem('inkwell_current_book_id');
    const savedBooks = localStorage.getItem('inkwell_books');
    if (savedCurrentBookId && savedBooks) {
      try {
        const books = JSON.parse(savedBooks) as Book[];
        return books.find(b => b.id === savedCurrentBookId) || null;
      } catch (e) {
        console.error('Failed to find saved current book', e);
      }
    }
    return null;
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pollinationsKey, setPollinationsKey] = useState<string>(localStorage.getItem('pollinations_key') || '');
  
  // Settings States
  const [authorName, setAuthorName] = useState<string>(() => {
    return localStorage.getItem('inkwell_author_name') || 'AI Writer';
  });
  const [defaultModelText, setDefaultModelText] = useState<string>(() => {
    return localStorage.getItem('inkwell_model_text') || TEXT_MODELS[0].id;
  });
  const [defaultModelImage, setDefaultModelImage] = useState<string>(() => {
    return localStorage.getItem('inkwell_model_image') || IMAGE_MODELS[0].id;
  });
  const [defaultBookFormat, setDefaultBookFormat] = useState<string>(() => {
    return localStorage.getItem('inkwell_book_format') || 'Standard PDF (A4)';
  });

  const [formData, setFormData] = useState<{
    description: string;
    genre: string;
    language: string;
    modelText: string;
    modelImage: string;
    volumes: number;
    pagesPerVolume: number;
    authorName: string;
    bookFormat: string;
  } | null>(() => {
    const savedStage = localStorage.getItem('inkwell_stage');
    const savedCurrentBookId = localStorage.getItem('inkwell_current_book_id');
    const savedBooks = localStorage.getItem('inkwell_books');
    if (savedStage === 'generating' && savedCurrentBookId && savedBooks) {
      try {
        const books = JSON.parse(savedBooks) as Book[];
        const book = books.find(b => b.id === savedCurrentBookId);
        if (book) {
          return {
            description: book.description,
            genre: book.genre,
            language: book.language,
            modelText: book.modelText,
            modelImage: book.modelImage,
            volumes: book.volumesCount || 1,
            pagesPerVolume: book.pagesPerVolume || 5,
            authorName: book.authorName || 'AI Writer',
            bookFormat: book.bookFormat || 'Standard PDF (A4)',
          };
        }
      } catch (e) {
        console.error('Failed to load form data for resumed generation', e);
      }
    }
    return null;
  });

  // Effective key: user-connected Pollen takes priority, otherwise fall back to the public key
  const effectiveApiKey = pollinationsKey || POLLINATIONS_PUBLIC_KEY;

  // Handle Pollinations redirect
  useEffect(() => {
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

  // Save active stage and current book ID to localStorage
  useEffect(() => {
    localStorage.setItem('inkwell_stage', stage);
  }, [stage]);

  useEffect(() => {
    if (currentBook) {
      localStorage.setItem('inkwell_current_book_id', currentBook.id);
    } else {
      localStorage.removeItem('inkwell_current_book_id');
    }
  }, [currentBook]);

  // Persist Settings
  useEffect(() => {
    localStorage.setItem('inkwell_author_name', authorName);
  }, [authorName]);

  useEffect(() => {
    localStorage.setItem('inkwell_model_text', defaultModelText);
  }, [defaultModelText]);

  useEffect(() => {
    localStorage.setItem('inkwell_model_image', defaultModelImage);
  }, [defaultModelImage]);

  useEffect(() => {
    localStorage.setItem('inkwell_book_format', defaultBookFormat);
  }, [defaultBookFormat]);

  const handleStartGeneration = (data: any) => {
    setFormData({
      ...data,
      modelText: defaultModelText,
      modelImage: defaultModelImage,
      authorName: authorName,
      bookFormat: defaultBookFormat
    });
    setStage('generating');
  };

  const handleGenerationComplete = (book: Book) => {
    setCurrentBook(book);
    setAllBooks(prev => {
      const exists = prev.some(b => b.id === book.id);
      if (exists) {
        return prev.map(b => b.id === book.id ? book : b);
      } else {
        return [book, ...prev];
      }
    });
    setStage('reader');
  };

  const handleSelectBook = (book: Book) => {
    setCurrentBook(book);
    if (book.isIncomplete) {
      setFormData({
        description: book.description,
        genre: book.genre,
        language: book.language,
        modelText: book.modelText,
        modelImage: book.modelImage,
        volumes: book.volumesCount || 1,
        pagesPerVolume: book.pagesPerVolume || 5,
        authorName: book.authorName || 'AI Writer',
        bookFormat: book.bookFormat || 'Standard PDF (A4)',
      });
      setStage('generating');
    } else {
      setStage('reader');
    }
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
    setAllBooks(prev => {
      const exists = prev.some(b => b.id === book.id);
      if (exists) {
        return prev.map(b => b.id === book.id ? book : b);
      } else {
        return [book, ...prev];
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-blue-500/30">
      
      {/* Top Right: Actions & Branding */}
      <div className="fixed top-6 right-6 z-[60] flex items-center gap-3">
        {/* Powered by */}
        <div className="hidden sm:flex flex-col items-end mr-2">
          <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-widest text-zinc-600">
            <span>Powered by</span>
            <a href="https://pollinations.ai" target="_blank" className="text-zinc-500 hover:text-blue-500 transition-colors">Pollinations.ai</a>
          </div>
        </div>

        {/* Settings Gear Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all text-zinc-400 hover:text-zinc-200"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* My Library Button */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all flex items-center gap-2 group"
        >
          <Library className="w-5 h-5 text-zinc-400 group-hover:text-blue-400" />
          <span className="text-sm font-medium">My Library</span>
        </button>

        {/* Create New Book Button */}
        {stage !== 'setup' && (
          <button
            onClick={() => {
              setStage('setup');
              setCurrentBook(null);
            }}
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all text-zinc-400 hover:text-zinc-200"
            title="Create New Book"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        {/* Connect Pollen Button */}
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

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: '-45%', x: '-50%' }}
              animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
              exit={{ opacity: 0, scale: 0.95, y: '-45%', x: '-50%' }}
              transition={{ duration: 0.2 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl z-[80]"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-6 h-6 text-blue-500" /> Creator Settings
                </h2>
                <button 
                  onClick={() => setIsSettingsOpen(false)} 
                  className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Author Name */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-300">Default Author Name</label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Enter author name..."
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-xl p-3 focus:outline-none transition-colors text-zinc-200 text-sm font-medium"
                  />
                  <span className="text-[10px] text-zinc-500 block">This name will appear on the book cover.</span>
                </div>

                {/* Book Format */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-300">Book Format</label>
                  <select
                    value={defaultBookFormat}
                    onChange={(e) => setDefaultBookFormat(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-xl p-3 focus:outline-none text-zinc-200 text-sm font-medium"
                  >
                    <option value="Standard PDF (A4)">Standard PDF (A4)</option>
                    <option value="KDP Format (6x9 Trade)">KDP Format (6x9 Trade)</option>
                    <option value="Google Play Books (5x8 ePUB/Compact)">Google Play Books (5x8 ePUB/Compact)</option>
                    <option value="ePUB (Markdown Package)">ePUB (Markdown Package)</option>
                  </select>
                  <span className="text-[10px] text-zinc-500 block">Determines page sizing and formatting for PDF downloads.</span>
                </div>

                {/* Text Writer Model */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-300">Writer Model (LLM)</label>
                  <select
                    value={defaultModelText}
                    onChange={(e) => setDefaultModelText(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-xl p-3 focus:outline-none text-zinc-200 text-sm font-medium"
                  >
                    {TEXT_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-zinc-500 block">The language model responsible for drafting story beats and prose.</span>
                </div>

                {/* Artist Model */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-300">Artist Model (Diffuser)</label>
                  <select
                    value={defaultModelImage}
                    onChange={(e) => setDefaultModelImage(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-xl p-3 focus:outline-none text-zinc-200 text-sm font-medium"
                  >
                    {IMAGE_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-zinc-500 block">The image generation model responsible for producing the book cover.</span>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all text-sm"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
                            {book.genre}
                          </span>
                          {book.isIncomplete && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                              <span className="w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
                              Incomplete
                            </span>
                          )}
                        </div>
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
            resumeBook={currentBook}
            onUpdateProgress={updateBook}
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
