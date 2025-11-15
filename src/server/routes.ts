// API route handlers

import { Router, Response } from 'express';
import { AuthRequest, jwtAuthMiddleware } from './jwtMiddleware';
import { storage } from './storage';
import { extractMetadata } from './metadata';
import { analyzeContent } from './ai';
import { handleGoogleLogin, handleAppleLogin } from './mobileAuth';
import { processVideo, detectVideoPlatform } from './video';
import { transformVideoContent } from './videoAI';
import { Item } from '../shared/schema';

const router = Router();

// Helper function to clean and summarize video titles
function cleanVideoTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  
  let cleaned = rawTitle;
  
  // Remove hashtags (words starting with #)
  cleaned = cleaned.replace(/#\w+/g, '').trim();
  
  // Remove common social media prefixes (e.g., "Jake Hurley on Instagram:")
  cleaned = cleaned.replace(/^[^:]+:\s*/i, '').trim();
  
  // Remove quotes if the entire title is wrapped in them
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
  
  // Remove extra whitespace and normalize
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Truncate to max 100 characters, but try to break at word boundary
  const maxLength = 100;
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
    const lastSpace = cleaned.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) { // Only truncate at word if we're not losing too much
      cleaned = cleaned.substring(0, lastSpace);
    }
    cleaned = cleaned.trim() + '...';
  }
  
  return cleaned || 'Video';
}

// Health check
router.get('/health', (req, res: Response) => {
  res.json({ status: 'ok', message: 'SmartVault Backend API' });
});

// Get current user
router.get('/auth/user', jwtAuthMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await storage.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  });
});

// Google login
router.post('/login/google', async (req, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    const result = await handleGoogleLogin(idToken);
    res.json(result);
  } catch (error: any) {
    console.error('Google login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

// Apple login
router.post('/login/apple', async (req, res: Response) => {
  try {
    const { identityToken, user: userInfo } = req.body;
    if (!identityToken) {
      return res.status(400).json({ error: 'identityToken is required' });
    }

    const result = await handleAppleLogin(identityToken, userInfo);
    res.json(result);
  } catch (error: any) {
    console.error('Apple login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

// Get all items
router.get('/items', jwtAuthMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const items = await storage.getItemsByUserId(req.user.id);
    res.json({ items });
  } catch (error: any) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Save link
router.post('/save-link', jwtAuthMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Extract metadata
    const metadata = await extractMetadata(url);

    // Analyze with AI (pass URL for better context)
    const aiAnalysis = await analyzeContent(
      metadata.title,
      metadata.description,
      { url: url }
    );

    // Save to database
    const item = await storage.createItem({
      userId: req.user.id,
      type: 'link',
      title: metadata.title,
      summary: aiAnalysis.summary,
      category: aiAnalysis.category,
      tags: [],
      url: url,
      imageUrl: metadata.imageUrl || undefined,
    });

    res.json({ success: true, item });
  } catch (error: any) {
    console.error('Save link error:', error);
    
    // Handle OpenAI API errors specifically
    if (error.message?.includes('quota') || error.message?.includes('billing')) {
      res.status(500).json({ 
        error: 'OpenAI quota exceeded. Please check your billing or use a different API key. The app will use fallback categorization.' 
      });
    } else if (error.message?.includes('model') || error.message?.includes('gpt')) {
      res.status(500).json({ 
        error: 'AI service error. Please check your OpenAI API key and model access.' 
      });
    } else {
      res.status(500).json({ error: error.message || 'Failed to save link' });
    }
  }
});

// Save note
router.post('/save-note', jwtAuthMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { title, content } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Analyze with AI
    const aiAnalysis = await analyzeContent(title, content);

    // Save to database
    const item = await storage.createItem({
      userId: req.user.id,
      type: 'note',
      title: title,
      summary: aiAnalysis.summary,
      category: aiAnalysis.category,
      tags: [],
      content: content,
    });

    res.json({ success: true, item });
  } catch (error: any) {
    console.error('Save note error:', error);
    
    // Handle OpenAI API errors specifically
    if (error.message?.includes('quota') || error.message?.includes('billing')) {
      res.status(500).json({ 
        error: 'OpenAI quota exceeded. Please check your billing or use a different API key. The app will use fallback categorization.' 
      });
    } else if (error.message?.includes('model') || error.message?.includes('gpt')) {
      res.status(500).json({ 
        error: 'AI service error. Please check your OpenAI API key and model access.' 
      });
    } else {
      res.status(500).json({ error: error.message || 'Failed to save note' });
    }
  }
});

// Get categories
router.get('/categories', jwtAuthMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const items = await storage.getItemsByUserId(req.user.id);
    const categories = new Set(items.map(item => item.category));
    res.json({ categories: Array.from(categories).sort() });
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Save video (TikTok, Instagram Reel, YouTube Short)
router.post('/save-video', jwtAuthMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Detect platform
    const platform = detectVideoPlatform(url);
    if (!platform.supported) {
      return res.status(400).json({ 
        error: 'Unsupported video platform. Supported: TikTok, Instagram Reels, YouTube Shorts' 
      });
    }

    console.log(`📹 Processing ${platform.type} video: ${url}`);

    // Step 1: Extract audio and transcribe
    const transcript = await processVideo(url);
    
    if (!transcript || transcript.trim().length === 0) {
      return res.status(500).json({ error: 'Failed to transcribe video audio' });
    }

    // Step 2: Transform transcript into structured content (includes AI-generated title)
    const aiAnalysis = await transformVideoContent(transcript, url);

    // Step 3: Use AI-generated title (prioritized) or fallback to metadata
    let title = aiAnalysis.title || `Video from ${platform.type}`;
    let imageUrl: string | undefined;
    
    try {
      const metadata = await extractMetadata(url);
      // Only use metadata title if AI didn't generate a good one
      if (!aiAnalysis.title || aiAnalysis.title === 'Video' || aiAnalysis.title.length < 5) {
        if (metadata.title) {
          // Clean and summarize title: remove hashtags, emojis, and truncate
          title = cleanVideoTitle(metadata.title);
        }
      }
      imageUrl = metadata.imageUrl || undefined;
    } catch (e) {
      // Metadata extraction is optional, continue without it
      console.warn('Metadata extraction failed, using AI-generated title');
    }

    // Step 4: Save to database
    const item = await storage.createItem({
      userId: req.user.id,
      type: 'video',
      title: title,
      summary: aiAnalysis.summary,
      category: aiAnalysis.category,
      tags: [],
      url: url,
      imageUrl: imageUrl,
      videoData: {
        platform: platform.type,
        transcript: transcript,
        structuredContent: aiAnalysis.structuredContent,
      },
    });

    console.log(`✅ Video saved successfully: ${item.id}`);
    res.json({ success: true, item });
  } catch (error: any) {
    console.error('Save video error:', error);
    
    // Handle specific errors
    if (error.message?.includes('yt-dlp') || error.message?.includes('extract')) {
      res.status(500).json({ 
        error: 'Failed to extract audio from video. Make sure yt-dlp is installed and the video is accessible.' 
      });
    } else if (error.message?.includes('Whisper') || error.message?.includes('transcribe')) {
      res.status(500).json({ 
        error: 'Failed to transcribe audio. Please check your OpenAI API key and Whisper access.' 
      });
    } else if (error.message?.includes('quota') || error.message?.includes('billing')) {
      res.status(500).json({ 
        error: 'OpenAI quota exceeded. Please check your billing.' 
      });
    } else {
      res.status(500).json({ error: error.message || 'Failed to save video' });
    }
  }
});

// Update item (for notes/annotations and note items)
router.patch('/items/:id', jwtAuthMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { id } = req.params;
    const { userNotes, title, content, summary, category } = req.body;

    // Get the existing item to check its type
    const existingItem = await storage.getItemById(id, req.user.id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updates: Partial<Item> = {};
    
    // Allow updating userNotes for any item
    if (userNotes !== undefined) {
      updates.userNotes = userNotes || undefined;
    }

    // Allow updating category for any item type
    if (category !== undefined) {
      // If category is null or empty string, set to empty string (not null, as DB schema requires not null)
      updates.category = category || '';
    }

    // Allow updating title, content, summary for note items only
    if (existingItem.type === 'note') {
      if (title !== undefined) {
        updates.title = title;
      }
      if (content !== undefined) {
        updates.content = content;
      }
      if (summary !== undefined) {
        updates.summary = summary;
      }
    }

    const updated = await storage.updateItem(id, req.user.id, updates);

    if (!updated) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, item: updated });
  } catch (error: any) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete item
router.delete('/items/:id', jwtAuthMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { id } = req.params;
    const deleted = await storage.deleteItem(id, req.user.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;

