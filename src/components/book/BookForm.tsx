import React, { useState } from 'react';
import { BookOpen, Sparkles, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface BookFormProps {
  onGenerate: (data: {
    description: string;
    genre: string;
    language: string;
    modelText: string;
    modelImage: string;
    volumes: number;
    pagesPerVolume: number;
  }) => void;
}

const GENRES = [
  'Fiction', 'Non-Fiction', 'Sci-Fi', 'Fantasy', 'Romance', 
  'Thriller', 'Mystery', 'Biography', 'History', 'Horror', 'Poetry'
];

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 
  'Japanese', 'Korean', 'Italian', 'Portuguese', 'Russian'
];

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

export function BookForm({ onGenerate }: BookFormProps) {
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState(GENRES[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [modelText, setModelText] = useState(TEXT_MODELS[0].id); // defaults to 'grok'
  const [modelImage, setModelImage] = useState(IMAGE_MODELS[0].id);
  const [volumes, setVolumes] = useState(1);
  const [pagesPerVolume, setPagesPerVolume] = useState(150);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    onGenerate({ description, genre, language, modelText, modelImage, volumes, pagesPerVolume });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto px-4 py-12"
    >
      <div className="text-center mb-10">
        <div className="inline-flex p-3 bg-zinc-900 rounded-2xl mb-4">
          <BookOpen className="w-8 h-8 text-blue-500" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Inkwell AI</h1>
        <p className="text-zinc-400">Transform your imagination into a fully written book.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 backdrop-blur-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Describe your book idea</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A detective in 1920s Tokyo investigates clockmaker murders..."
            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Genre</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Volumes</label>
            <input
              type="number"
              min={1}
              max={10}
              value={volumes}
              onChange={(e) => setVolumes(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[10px] text-zinc-500 block">Create a single book or a multi-volume series</span>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Pages per Volume</label>
            <input
              type="number"
              min={10}
              max={1000}
              value={pagesPerVolume}
              onChange={(e) => setPagesPerVolume(Math.max(10, parseInt(e.target.value) || 10))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[10px] text-zinc-500 block">Target page count (~250 words per page)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Writer Model</label>
            <select
              value={modelText}
              onChange={(e) => setModelText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TEXT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Artist Model</label>
            <select
              value={modelImage}
              onChange={(e) => setModelImage(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={!description.trim()}
          className={cn(
            "w-full py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
            "group"
          )}
        >
          <Sparkles className="w-5 h-5" />
          Generate Book
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </form>
    </motion.div>
  );
}
