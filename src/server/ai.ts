// AI integration for categorization and summarization

export interface AIAnalysis {
  category: string;
  summary: string;
}

export interface AnalyzeContentOptions {
  url?: string; // Full URL for better context
}

// Fixed categories (use these first if they match)
const FIXED_CATEGORIES = [
  'Technology',
  'Business',
  'Finance',
  'Marketing',
  'Productivity',
  'Self-Improvement',
  'Health',
  'Fitness',
  'Cooking',
  'Design',
  'Creative',
  'AI',
  'Programming',
  'Science',
  'Education',
  'Lifestyle',
];

// Mock AI function (replace with real OpenAI API)
// COMMENTED OUT - Using real OpenAI below
/*
export async function analyzeContent(
  title: string,
  content: string | null
): Promise<AIAnalysis> {
  // For now, use simple heuristics
  // In production, replace with OpenAI API call
  
  const text = `${title} ${content || ''}`.toLowerCase();
  
  // Simple category detection
  let category = 'Other';
  if (text.match(/\b(tech|software|app|code|programming|ai|ml|computer)\b/i)) {
    category = 'Technology';
  } else if (text.match(/\b(business|startup|company|finance|money|invest)\b/i)) {
    category = 'Business';
  } else if (text.match(/\b(movie|film|music|game|entertainment|show)\b/i)) {
    category = 'Entertainment';
  } else if (text.match(/\b(news|article|report|journalism)\b/i)) {
    category = 'News';
  } else if (text.match(/\b(learn|course|education|school|university)\b/i)) {
    category = 'Education';
  } else if (text.match(/\b(health|medical|fitness|wellness|doctor)\b/i)) {
    category = 'Health';
  } else if (text.match(/\b(art|design|creative|photo|drawing)\b/i)) {
    category = 'Creative';
  } else if (text.match(/\b(science|research|study|experiment)\b/i)) {
    category = 'Science';
  } else if (text.match(/\b(personal|note|reminder|todo)\b/i)) {
    category = 'Personal';
  }

  // Generate summary
  const summary = content
    ? content.length > 150
      ? content.substring(0, 147) + '...'
      : content
    : `Content about ${title}`;

  return {
    category,
    summary,
  };
}
*/

// Real OpenAI integration
import OpenAI from 'openai';

// Initialize OpenAI client lazily (after env vars are loaded)
let openai: OpenAI | null = null;
let initializationAttempted = false;

function initializeOpenAI(): OpenAI | null {
  if (initializationAttempted) {
    return openai;
  }
  
  initializationAttempted = true;
  
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY is not set in environment variables');
      console.error('   Please create a .env file in the backend directory with:');
      console.error('   OPENAI_API_KEY=sk-proj-...');
      return null;
    }
    
    openai = new OpenAI({
      apiKey: apiKey,
    });
    console.log('✅ OpenAI client initialized successfully');
    console.log(`   API Key length: ${apiKey.length} characters`);
    console.log(`   API Key prefix: ${apiKey.substring(0, 7)}...`);
    return openai;
  } catch (error) {
    console.error('❌ Failed to initialize OpenAI client:', error);
    return null;
  }
}

// Fallback analysis when OpenAI fails
function fallbackAnalysis(title: string, content: string | null, url?: string): AIAnalysis {
  // Generate summary from content or title
  const textSource = content || title || '';
  const summary = textSource.slice(0, 160).trim() || 'No summary available.';
  
  return {
    category: 'General',
    summary: summary.length > 200 ? summary.substring(0, 197) + '...' : summary,
  };
}

// Validate and clean category
function validateCategory(category: string): string {
  if (!category || typeof category !== 'string') {
    return 'General';
  }
  
  // Trim and clean
  let cleaned = category.trim();
  
  // Remove emojis and special characters (keep letters, numbers, spaces, hyphens)
  cleaned = cleaned.replace(/[^\w\s-]/g, '');
  
  // Capitalize first letter of each word
  cleaned = cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  // Limit to 2 words
  const words = cleaned.split(/\s+/).slice(0, 2);
  cleaned = words.join(' ');
  
  // Check if it matches a fixed category (case-insensitive)
  const fixedMatch = FIXED_CATEGORIES.find(
    fixed => fixed.toLowerCase() === cleaned.toLowerCase()
  );
  if (fixedMatch) {
    return fixedMatch;
  }
  
  // If empty or weird, return General
  if (!cleaned || cleaned.length < 2) {
    return 'General';
  }
  
  return cleaned;
}

// Validate and clean summary
function validateSummary(summary: string, title: string, content: string | null): string {
  if (!summary || typeof summary !== 'string') {
    // Generate from content or title
    const textSource = content || title || '';
    return textSource.slice(0, 160).trim() || 'No summary available.';
  }
  
  // Trim whitespace
  let cleaned = summary.trim();
  
  // Remove emojis
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
  cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
  cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');
  cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');
  
  // Remove markdown
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/__/g, '');
  cleaned = cleaned.replace(/_/g, '');
  cleaned = cleaned.replace(/`/g, '');
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Remove markdown links
  
  // Ensure it doesn't just repeat the title
  const titleLower = title.toLowerCase().trim();
  const summaryLower = cleaned.toLowerCase().trim();
  if (summaryLower === titleLower || summaryLower.startsWith(titleLower + ' ')) {
    // Generate from content instead
    if (content) {
      cleaned = content.slice(0, 160).trim();
    } else {
      cleaned = `Information about ${title}`;
    }
  }
  
  // Limit to 200 characters
  if (cleaned.length > 200) {
    // Try to cut at sentence boundary
    const truncated = cleaned.substring(0, 200);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
    
    if (lastSentenceEnd > 50) {
      cleaned = cleaned.substring(0, lastSentenceEnd + 1);
    } else {
      // Cut at word boundary
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 50) {
        cleaned = cleaned.substring(0, lastSpace) + '...';
      } else {
        cleaned = truncated + '...';
      }
    }
  }
  
  return cleaned || 'No summary available.';
}

export async function analyzeContent(
  title: string,
  content: string | null,
  options?: AnalyzeContentOptions
): Promise<AIAnalysis> {
  const url = options?.url;
  
  // Initialize OpenAI client if not already done
  const client = initializeOpenAI();
  if (!client) {
    console.error('❌ OpenAI client not initialized - using fallback analysis');
    console.error('   Reason: OPENAI_API_KEY not set or invalid');
    return fallbackAnalysis(title, content, url);
  }

  // Check if API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable not set - using fallback analysis');
    return fallbackAnalysis(title, content, url);
  }

  // Build system prompt
  const systemPrompt = `You are a content categorization and summarization assistant.

CATEGORY RULES:
1. First, check if the content matches one of these fixed categories: ${FIXED_CATEGORIES.join(', ')}
2. If none truly fit, generate a NEW category that:
   - Is 1-2 words maximum
   - No emojis
   - Capitalized (e.g., "Crypto", "Travel", "Gaming", "Web3")
   - Broad, not niche
   - Does NOT duplicate any fixed category
   - Makes sense as a topic label

SUMMARY RULES:
- 1-2 sentences maximum
- No emojis
- No markdown formatting
- Maximum 200 characters
- Must NOT repeat the title
- Clear and simple language

OUTPUT FORMAT:
You MUST return ONLY valid JSON in this exact structure:
{
  "summary": "string here",
  "category": "string here"
}

No explanations, no markdown code blocks, no additional text. Only the JSON object.`;

  // Build user prompt
  const userPrompt = `Analyze this content:

Title: "${title}"
${content ? `Content: "${content.substring(0, 1000)}"` : ''}
${url ? `URL: "${url}"` : ''}

Return JSON with "summary" and "category" fields only.`;

  // Try models in order: gpt-4o-mini -> gpt-4-turbo -> gpt-3.5-turbo
  // Note: gpt-4.1-mini doesn't exist, using gpt-4o-mini instead
  const models = ['gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  let lastError: any = null;

  console.log('🤖 Starting AI analysis...');
  console.log(`   Title: "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}"`);
  console.log(`   Content length: ${content?.length || 0} chars`);
  console.log(`   URL: ${url || 'N/A'}`);

  for (const model of models) {
    try {
      console.log(`   Trying model: ${model}...`);
      
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: 'json_object' }, // Force JSON response
      });

      const aiContent = response.choices[0].message.content || '{}';
      console.log(`   ✅ Model ${model} responded successfully`);
      console.log(`   Raw response: ${aiContent.substring(0, 100)}...`);
      
      // Parse JSON
      let result: any;
      try {
        result = JSON.parse(aiContent);
        console.log(`   ✅ Parsed JSON successfully`);
        console.log(`   Raw category: "${result.category}"`);
        console.log(`   Raw summary: "${result.summary?.substring(0, 50)}..."`);
      } catch (parseError) {
        console.warn(`   ⚠️ JSON parse failed, trying to extract from markdown...`);
        // Try to extract JSON from markdown code blocks
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
          console.log(`   ✅ Extracted JSON from markdown`);
        } else {
          throw new Error('Invalid JSON response - no JSON found');
        }
      }

      // Validate and clean response
      const validatedCategory = validateCategory(result.category || '');
      const validatedSummary = validateSummary(
        result.summary || '',
        title,
        content
      );

      console.log(`   ✅ Final category: "${validatedCategory}"`);
      console.log(`   ✅ Final summary: "${validatedSummary.substring(0, 50)}..."`);
      console.log('🤖 AI analysis completed successfully');

      return {
        category: validatedCategory,
        summary: validatedSummary,
      };
    } catch (error: any) {
      lastError = error;
      
      // Detailed error logging
      console.error(`   ❌ Model ${model} failed:`);
      console.error(`      Error type: ${error.constructor?.name || 'Unknown'}`);
      console.error(`      Error message: ${error.message || 'No message'}`);
      console.error(`      Error status: ${error.status || 'N/A'}`);
      console.error(`      Error code: ${error.code || 'N/A'}`);
      if (error.response?.data) {
        console.error(`      Error response data:`, JSON.stringify(error.response.data, null, 2));
      }
      
      // If it's a model-specific error (like model not found), try next model
      if (error.message?.includes('model') || error.status === 404 || error.code === 'model_not_found') {
        console.warn(`   ⚠️ Model ${model} not available, trying next model...`);
        continue;
      }
      
      // For other errors, break and use fallback
      console.error(`   ❌ Non-model error, stopping model attempts`);
      break;
    }
  }

  // All models failed, use fallback
  console.error('❌ All AI models failed, using fallback analysis');
  console.error(`   Last error: ${lastError?.message || 'Unknown error'}`);
  console.error(`   Last error status: ${lastError?.status || 'N/A'}`);
  console.error(`   Last error code: ${lastError?.code || 'N/A'}`);
  if (lastError?.response?.data) {
    console.error(`   Last error response:`, JSON.stringify(lastError.response.data, null, 2));
  }
  return fallbackAnalysis(title, content, url);
}

