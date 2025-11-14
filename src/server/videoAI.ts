// AI transformation for video transcripts into structured content

import OpenAI from 'openai';

export interface VideoStructuredContent {
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
}

export interface VideoAIAnalysis {
  category: string;
  summary: string;
  structuredContent: VideoStructuredContent;
}

// Transform video transcript into structured content
export async function transformVideoContent(
  transcript: string,
  url: string
): Promise<VideoAIAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }
  
  const client = new OpenAI({ apiKey });

  console.log('🤖 Transforming video transcript into structured content...');
  console.log(`   Transcript length: ${transcript.length} characters`);
  console.log(`   URL: ${url}`);

  const systemPrompt = `You are an expert content transformation assistant that converts video transcripts into highly structured, detailed data.

Your task is to analyze the transcript and determine if it contains:
1. A RECIPE (cooking instructions with ingredients and cooking steps)
2. A WORKOUT (exercise routine with movements and repetitions)
3. A TUTORIAL (step-by-step instructions for learning something)
4. GENERAL (anything else)

OUTPUT FORMAT:
You MUST return ONLY valid JSON in this exact structure:
{
  "type": "recipe" | "workout" | "tutorial" | "general",
  "category": "string (e.g., Cooking, Fitness, Programming, etc.)",
  "summary": "1-2 sentence summary, max 200 chars",
  "recipe": {
    "name": "Recipe name (extract the exact recipe name mentioned)",
    "ingredients": ["ingredient with full quantity and unit", ...],
    "instructions": ["detailed step-by-step instruction", ...],
    "servings": number (extract if mentioned, e.g., "serves 4" = 4),
    "prepTime": "string (extract if mentioned, e.g., "10 minutes", "5 min")",
    "cookTime": "string (extract if mentioned, e.g., "30 minutes", "1 hour")"
  },
  "workout": {
    "name": "Workout name",
    "exercises": [
      {
        "name": "Exercise name",
        "sets": number (optional),
        "reps": "string (optional)",
        "duration": "string (optional)",
        "rest": "string (optional)"
      }
    ],
    "duration": "string (optional)",
    "difficulty": "string (optional)"
  },
  "tutorial": {
    "title": "Tutorial title",
    "steps": [
      {
        "step": number,
        "description": "step description",
        "tips": "optional tip"
      }
    ],
    "tools": ["tool 1", "tool 2"] (optional),
    "difficulty": "string (optional)"
  }
}

CRITICAL RECIPE EXTRACTION RULES:
1. INGREDIENTS:
   - Extract EVERY ingredient mentioned, even if quantities are approximate
   - Include FULL quantities with units (e.g., "2 cups flour", "1 teaspoon salt", "3 large eggs")
   - If quantity is mentioned as "a pinch", "a dash", "to taste", include it exactly as stated
   - Include preparation notes if mentioned (e.g., "2 cups all-purpose flour, sifted", "3 cloves garlic, minced")
   - List ingredients in the order they appear or are typically used
   - If substitutes or alternatives are mentioned, include them in the ingredient list

2. INSTRUCTIONS:
   - Break down into clear, numbered steps
   - Include ALL cooking details: temperatures, times, techniques
   - Extract specific temperatures if mentioned (e.g., "bake at 350°F", "cook on medium heat")
   - Include timing for each step if specified (e.g., "cook for 5 minutes", "let rest for 10 minutes")
   - Include cooking methods (e.g., "sauté", "bake", "simmer", "whisk", "fold")
   - Include visual cues if mentioned (e.g., "until golden brown", "until doubled in size")
   - Preserve important details like "don't overmix", "be careful not to burn", etc.
   - If multiple methods are shown, include all relevant steps

3. METADATA:
   - Extract servings if mentioned (look for: "serves X", "makes X servings", "feeds X people")
   - Extract prep time if mentioned (look for: "prep time", "preparation", "prep")
   - Extract cook time if mentioned (look for: "cook time", "baking time", "cooking time", "total time")
   - If total time is given but not prep/cook separately, estimate or use total time for cookTime

4. RECIPE NAME:
   - Extract the exact recipe name as mentioned in the video
   - If not explicitly stated, infer from main ingredients or dish type
   - Be descriptive but concise

5. CONSISTENCY:
   - Ensure all measurements use consistent units when possible
   - Preserve original measurements if mixing units (e.g., "1 cup + 2 tablespoons")
   - Include all special instructions, tips, or warnings mentioned
   - Don't skip steps - if the transcript mentions something, include it

IMPORTANT:
- Only include the block (recipe, workout, or tutorial) that matches the content type
- If type is "general", omit recipe, workout, and tutorial blocks
- Extract ALL details from the transcript - be thorough, not minimal
- Be precise with measurements, times, temperatures, and techniques
- If information is missing, don't make it up - only include what's in the transcript
- For recipes, prioritize completeness and accuracy over brevity`;

  const userPrompt = `Analyze this video transcript and extract ALL structured content with maximum detail:

Transcript:
"${transcript}"

URL: ${url}

INSTRUCTIONS:
1. Carefully read the ENTIRE transcript
2. Identify the content type (recipe, workout, tutorial, or general)
3. For RECIPES: Extract EVERY ingredient with full quantities and units, ALL cooking steps with details (temperatures, times, techniques), and any metadata (servings, prep time, cook time)
4. Be thorough - include all details mentioned, even if they seem minor
5. Preserve the exact wording for measurements and instructions when possible
6. Return complete, detailed JSON with all available information

Return JSON with the appropriate structure based on the content type.`;

  const models = ['gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  let lastError: any = null;

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
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });

      const aiContent = response.choices[0].message.content || '{}';
      console.log(`   ✅ Model ${model} responded successfully`);

      // Parse JSON
      let result: any;
      try {
        result = JSON.parse(aiContent);
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response');
        }
      }

      // Validate and structure response
      // Ensure recipe data is complete and properly formatted
      let recipeData = result.recipe;
      if (recipeData) {
        // Ensure ingredients is an array
        if (!Array.isArray(recipeData.ingredients)) {
          recipeData.ingredients = [];
        }
        // Ensure instructions is an array
        if (!Array.isArray(recipeData.instructions)) {
          recipeData.instructions = [];
        }
        // Ensure name exists
        if (!recipeData.name || recipeData.name.trim() === '') {
          recipeData.name = 'Untitled Recipe';
        }
        // Clean and validate servings
        if (recipeData.servings && typeof recipeData.servings === 'string') {
          const servingsMatch = recipeData.servings.match(/\d+/);
          if (servingsMatch) {
            recipeData.servings = parseInt(servingsMatch[0], 10);
          } else {
            delete recipeData.servings;
          }
        }
        // Ensure times are strings if present
        if (recipeData.prepTime && typeof recipeData.prepTime !== 'string') {
          recipeData.prepTime = String(recipeData.prepTime);
        }
        if (recipeData.cookTime && typeof recipeData.cookTime !== 'string') {
          recipeData.cookTime = String(recipeData.cookTime);
        }
      }

      const structuredContent: VideoStructuredContent = {
        type: result.type || 'general',
        ...(recipeData && { recipe: recipeData }),
        ...(result.workout && { workout: result.workout }),
        ...(result.tutorial && { tutorial: result.tutorial }),
      };

      const category = result.category || 'General';
      const summary = result.summary || transcript.substring(0, 200);

      console.log(`   ✅ Content type: ${structuredContent.type}`);
      console.log(`   ✅ Category: ${category}`);
      console.log(`   ✅ Summary: ${summary.substring(0, 50)}...`);

      return {
        category,
        summary: summary.length > 200 ? summary.substring(0, 197) + '...' : summary,
        structuredContent,
      };
    } catch (error: any) {
      lastError = error;
      console.error(`   ❌ Model ${model} failed: ${error.message}`);

      if (error.message?.includes('model') || error.status === 404 || error.code === 'model_not_found') {
        console.warn(`   ⚠️ Model ${model} not available, trying next model...`);
        continue;
      }

      break;
    }
  }

  // Fallback if all models fail
  console.error('❌ All AI models failed, using fallback');
  return {
    category: 'General',
    summary: transcript.substring(0, 200),
    structuredContent: {
      type: 'general',
    },
  };
}

