
export interface Beat {
  id: string;
  title: string;
  description: string;
  draft?: string;
  completed?: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  beats: Beat[];
}

export interface LoreEntry {
  id: string;
  category: string;
  content: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  traits: string[];
  imageUrl?: string;
  rationale?: string; 
}

export interface Location {
  id: string;
  name: string;
  atmosphere: string;
  description: string;
  imageUrl?: string;
  rationale?: string;
}

export interface WorldSettings {
  genre: string;
  fantasyLevel: number;
  techLevel: number;
  tone: string;
  proseStyle: string;
  language: string;
  criticismLevel: number;
}

export interface StoryAnalysis {
  consistency: string;
  suggestions: string[];
  suggestedBeats: {
    chapterId: string;
    title: string;
    description: string;
    rationale: string;
  }[];
  suggestedChapterFlow: {
    chapterId: string;
    suggestedBeatIds: string[];
    reasoning: string;
  }[];
  proposedLore: (LoreEntry & { rationale: string })[];
  proposedCharacters: Character[];
  proposedLocations: Location[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
