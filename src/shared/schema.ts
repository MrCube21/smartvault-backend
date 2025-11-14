// Database schema definitions

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Item {
  id: string;
  userId: string;
  type: 'link' | 'note' | 'video';
  title: string;
  summary: string;
  category: string;
  tags: string[];
  createdAt: Date;
  // User notes/annotations
  userNotes?: string;
  // Link-specific
  url?: string;
  imageUrl?: string;
  // Note-specific
  content?: string;
  // Video-specific
  videoData?: {
    platform: 'tiktok' | 'instagram' | 'youtube';
    transcript?: string;
    structuredContent?: {
      type: 'recipe' | 'workout' | 'tutorial' | 'general';
      recipe?: {
        name: string;
        ingredients: string[];
        instructions: string[];
        servings?: number;
        prepTime?: string;
        cookTime?: string;
      };
      workout?: {
        name: string;
        exercises: Array<{
          name: string;
          sets?: number;
          reps?: string;
          duration?: string;
          rest?: string;
        }>;
        duration?: string;
        difficulty?: string;
      };
      tutorial?: {
        title: string;
        steps: Array<{
          step: number;
          description: string;
          tips?: string;
        }>;
        tools?: string[];
        difficulty?: string;
      };
    };
  };
}

export interface Session {
  sid: string;
  sess: any;
  expire: Date;
}

