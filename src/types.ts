export interface Chapter {
  number: number;
  title: string;
  summary: string;
  content: string;
  isGenerating?: boolean;
}

export interface Book {
  id: string;
  title: string;
  description: string;
  genre: string;
  language: string;
  coverUrl: string;
  chapters: Chapter[];
  createdAt: string;
  modelText: string;
  modelImage: string;
}

export type AppStage = 'setup' | 'generating' | 'reader';
