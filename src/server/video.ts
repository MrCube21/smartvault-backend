// Video processing pipeline for TikTok, Instagram Reels, and YouTube Shorts

import { exec } from 'child_process';
import { promisify } from 'util';
import { unlinkSync, readFileSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import OpenAI from 'openai';

const execAsync = promisify(exec);

export interface VideoPlatform {
  type: 'tiktok' | 'instagram' | 'youtube';
  supported: boolean;
}

export interface VideoProcessingResult {
  transcript: string;
  audioFormat: string;
}

// Detect video platform from URL
export function detectVideoPlatform(url: string): VideoPlatform {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com')) {
    return { type: 'tiktok', supported: true };
  }
  
  if (urlLower.includes('instagram.com') && (urlLower.includes('/reel/') || urlLower.includes('/reels/'))) {
    return { type: 'instagram', supported: true };
  }
  
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    // Check if it's a Short (typically /shorts/ or short duration)
    if (urlLower.includes('/shorts/') || urlLower.includes('youtube.com/shorts/')) {
      return { type: 'youtube', supported: true };
    }
    // For now, support all YouTube videos (can be refined later)
    return { type: 'youtube', supported: true };
  }
  
  return { type: 'youtube', supported: false };
}

// Extract audio using yt-dlp
export async function extractAudio(url: string): Promise<VideoProcessingResult> {
  const platform = detectVideoPlatform(url);
  
  if (!platform.supported) {
    throw new Error(`Unsupported video platform: ${url}`);
  }

  // Create temporary file for audio
  const tempDir = tmpdir();
  const audioFile = join(tempDir, `audio-${Date.now()}.m4a`);
  
  try {
    console.log(`🎬 Extracting audio from ${platform.type} video...`);
    console.log(`   URL: ${url}`);
    
    // Use yt-dlp to extract audio
    // Try m4a first, fallback to webm
    let audioFormat = 'm4a';
    let command = `yt-dlp -x --audio-format m4a --audio-quality 0 -o "${audioFile}" "${url}"`;
    
    try {
      await execAsync(command, { timeout: 60000 }); // 60 second timeout
    } catch (error: any) {
      // Try webm format as fallback
      console.log('   ⚠️ m4a extraction failed, trying webm...');
      audioFormat = 'webm';
      const webmFile = audioFile.replace('.m4a', '.webm');
      command = `yt-dlp -x --audio-format webm --audio-quality 0 -o "${webmFile}" "${url}"`;
      await execAsync(command, { timeout: 60000 });
      
      // Update audioFile path
      const actualFile = webmFile.replace('.webm', '') + '.webm';
      if (actualFile !== audioFile) {
        // Read the actual file
        const audioBuffer = readFileSync(actualFile);
        // Write to expected location
        require('fs').writeFileSync(audioFile.replace('.m4a', '.webm'), audioBuffer);
        unlinkSync(actualFile);
      }
    }
    
    // Read audio file into buffer
    const actualAudioFile = audioFile.replace('.m4a', `.${audioFormat}`);
    const audioBuffer = readFileSync(actualAudioFile);
    
    console.log(`   ✅ Audio extracted: ${audioBuffer.length} bytes, format: ${audioFormat}`);
    
    // Clean up temp file
    try {
      unlinkSync(actualAudioFile);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return {
      transcript: '', // Will be filled by transcribeAudio
      audioFormat,
    };
  } catch (error: any) {
    // Clean up on error
    try {
      unlinkSync(audioFile);
    } catch (e) {
      // Ignore
    }
    
    console.error(`   ❌ Audio extraction failed: ${error.message}`);
    throw new Error(`Failed to extract audio: ${error.message}`);
  }
}

// Transcribe audio using OpenAI Whisper
export async function transcribeAudio(audioBuffer: Buffer, audioFormat: string): Promise<string> {
  // Initialize OpenAI client
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }
  
  const openai = new OpenAI({ apiKey });
  
  try {
    console.log('🎤 Transcribing audio with Whisper...');
    console.log(`   Audio size: ${audioBuffer.length} bytes`);
    console.log(`   Format: ${audioFormat}`);
    
    // Create a File-like object for Whisper API
    // Whisper API expects a File object, so we need to create a temporary file
    const tempDir = tmpdir();
    const tempFile = join(tempDir, `whisper-${Date.now()}.${audioFormat}`);
    
    try {
      require('fs').writeFileSync(tempFile, audioBuffer);
      
      // OpenAI Whisper API expects a File object or ReadStream
      // Create a File-like object using fs.createReadStream
      const fs = require('fs');
      const readStream = fs.createReadStream(tempFile);
      
      const transcription = await openai.audio.transcriptions.create({
        file: readStream,
        model: 'whisper-1',
        language: 'en', // Optional: specify language
      });
      
      const transcript = transcription.text;
      console.log(`   ✅ Transcription complete: ${transcript.length} characters`);
      console.log(`   Preview: ${transcript.substring(0, 100)}...`);
      
      // Clean up
      try {
        unlinkSync(tempFile);
      } catch (e) {
        // Ignore
      }
      
      return transcript;
    } catch (fileError: any) {
      // Clean up on error
      try {
        unlinkSync(tempFile);
      } catch (e) {
        // Ignore
      }
      throw fileError;
    }
  } catch (error: any) {
    console.error(`   ❌ Whisper transcription failed: ${error.message}`);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

// Extract captions/subtitles from video using yt-dlp
export async function extractCaptions(url: string): Promise<string | null> {
  const tempDir = tmpdir();
  const captionFile = join(tempDir, `captions-${Date.now()}.%(ext)s`);
  
  try {
    console.log('📝 Attempting to extract captions/subtitles...');
    
    // Find yt-dlp executable
    const ytdlpPaths = [
      'yt-dlp', // Try system PATH first
      '/usr/bin/yt-dlp', // Alpine Linux pip install location
      '/usr/local/bin/yt-dlp', // Common pip/Homebrew location
      '/opt/homebrew/bin/yt-dlp', // Apple Silicon Homebrew location
      '/Users/lorispassafaro/Library/Python/3.10/bin/yt-dlp', // macOS user pip install location
    ];
    
    let ytdlpCmd = 'yt-dlp';
    for (const path of ytdlpPaths) {
      try {
        const { stdout } = await execAsync(`which ${path} 2>/dev/null || echo ""`);
        if (stdout.trim()) {
          ytdlpCmd = path;
          break;
        }
      } catch (e) {
        // Try next path
      }
    }
    
    // Also try direct file check
    if (ytdlpCmd === 'yt-dlp') {
      for (const path of ytdlpPaths.slice(1)) {
        if (existsSync(path)) {
          ytdlpCmd = path;
          break;
        }
      }
    }
    
    // Try to extract captions/subtitles
    // yt-dlp can extract subtitles with --write-subs and --sub-lang
    // Prefer English, but try any available language
    let command = `"${ytdlpCmd}" --no-check-certificate --write-auto-sub --write-sub --sub-lang en,en-US,en-GB --skip-download -o "${captionFile}" "${url}" 2>&1`;
    
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 }); // 30 second timeout
      
      // Look for subtitle files in temp directory
      const timestamp = captionFile.split('-').pop()?.replace('.%(ext)', '') || '';
      const files = readdirSync(tempDir).filter((f: string) => 
        (f.includes('captions-') || f.includes(timestamp)) && 
        (f.endsWith('.vtt') || f.endsWith('.srt') || f.endsWith('.ttml') || f.endsWith('.json3'))
      );
      
      if (files.length > 0) {
        // Prefer .vtt or .srt files (most common formats)
        let subtitleFile = files.find(f => f.endsWith('.vtt') || f.endsWith('.srt')) || files[0];
        subtitleFile = join(tempDir, subtitleFile);
        
        console.log(`   ✅ Found captions file: ${subtitleFile}`);
        
        // Read and parse subtitle file
        const subtitleContent = readFileSync(subtitleFile, 'utf-8');
        
        // Parse VTT format (most common)
        if (subtitleFile.endsWith('.vtt')) {
          // Remove VTT header and timing information, keep only text
          const lines = subtitleContent.split('\n');
          const textLines: string[] = [];
          let inCue = false;
          
          for (const line of lines) {
            const trimmed = line.trim();
            // Skip VTT header, timing lines, and empty lines
            if (trimmed === '' || trimmed.startsWith('WEBVTT') || trimmed.includes('-->') || trimmed.match(/^\d+$/)) {
              inCue = false;
              continue;
            }
            // Text content
            if (trimmed.length > 0 && !trimmed.startsWith('<')) {
              textLines.push(trimmed);
              inCue = true;
            }
          }
          
          const captionText = textLines.join(' ').replace(/\s+/g, ' ').trim();
          
          // Clean up
          try {
            unlinkSync(subtitleFile);
            // Also clean up any other subtitle files
            files.forEach(f => {
              try {
                unlinkSync(join(tempDir, f));
              } catch (e) {
                // Ignore
              }
            });
          } catch (e) {
            // Ignore cleanup errors
          }
          
          if (captionText.length > 50) {
            console.log(`   ✅ Captions extracted: ${captionText.length} characters`);
            return captionText;
          }
        }
        
        // Parse SRT format
        if (subtitleFile.endsWith('.srt')) {
          const lines = subtitleContent.split('\n');
          const textLines: string[] = [];
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Skip sequence numbers and timing lines
            if (line === '' || line.match(/^\d+$/) || line.includes('-->')) {
              continue;
            }
            // Text content
            if (line.length > 0) {
              textLines.push(line);
            }
          }
          
          const captionText = textLines.join(' ').replace(/\s+/g, ' ').trim();
          
          // Clean up
          try {
            unlinkSync(subtitleFile);
            files.forEach(f => {
              try {
                unlinkSync(join(tempDir, f));
              } catch (e) {
                // Ignore
              }
            });
          } catch (e) {
            // Ignore cleanup errors
          }
          
          if (captionText.length > 50) {
            console.log(`   ✅ Captions extracted: ${captionText.length} characters`);
            return captionText;
          }
        }
      }
      
      console.log('   ⚠️ No captions found or captions too short');
      return null;
    } catch (error: any) {
      console.log(`   ⚠️ Caption extraction failed: ${error.message}`);
      return null;
    }
  } catch (error: any) {
    console.log(`   ⚠️ Caption extraction error: ${error.message}`);
    return null;
  }
}

// Process video: try captions first, then extract audio and transcribe
export async function processVideo(url: string): Promise<string> {
  const platform = detectVideoPlatform(url);
  
  if (!platform.supported) {
    throw new Error(`Unsupported video platform: ${url}`);
  }

  const tempDir = tmpdir();
  const outputFile = join(tempDir, `audio-${Date.now()}`);
  
  try {
    console.log(`🎬 Processing ${platform.type} video...`);
    
    // Step 1: Try to extract captions/subtitles first (faster and more accurate)
    const captions = await extractCaptions(url);
    if (captions && captions.length > 50) {
      console.log('   ✅ Using captions/subtitles for analysis (more accurate than audio transcription)');
      return captions;
    }
    
    console.log('   ⚠️ No captions available, falling back to audio transcription...');
    
    // Step 2: Fallback to audio extraction and transcription
    // Find yt-dlp executable
    const ytdlpPaths = [
      'yt-dlp', // Try system PATH first
      '/usr/bin/yt-dlp', // Alpine Linux pip install location
      '/usr/local/bin/yt-dlp', // Common pip/Homebrew location
      '/opt/homebrew/bin/yt-dlp', // Apple Silicon Homebrew location
      '/Users/lorispassafaro/Library/Python/3.10/bin/yt-dlp', // macOS user pip install location
    ];
    
    let ytdlpCmd = 'yt-dlp';
    for (const path of ytdlpPaths) {
      try {
        const { stdout } = await execAsync(`which ${path} 2>/dev/null || echo ""`);
        if (stdout.trim()) {
          ytdlpCmd = path;
          break;
        }
      } catch (e) {
        // Try next path
      }
    }
    
    // Also try direct file check
    if (ytdlpCmd === 'yt-dlp') {
      for (const path of ytdlpPaths.slice(1)) {
        if (existsSync(path)) {
          ytdlpCmd = path;
          break;
        }
      }
    }
    
    console.log(`   Using yt-dlp: ${ytdlpCmd}`);
    
    // Extract audio using yt-dlp
    // Use -f bestaudio to get audio directly without requiring ffmpeg
    // Note: --no-check-certificate is used as a workaround for SSL certificate issues on macOS
    // Prefer m4a/opus, fallback to any audio format
    let command = `"${ytdlpCmd}" --no-check-certificate -f "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio" -o "${outputFile}.%(ext)s" "${url}"`;
    
    let audioFormat = 'm4a';
    let actualFile = '';
    
    try {
      await execAsync(command, { timeout: 120000 }); // 2 minute timeout
      
      // Find the actual output file (yt-dlp will use the best available format)
      const possibleFiles = [
        `${outputFile}.m4a`,
        `${outputFile}.webm`,
        `${outputFile}.opus`,
        `${outputFile}.ogg`,
        `${outputFile}.mp3`,
      ];
      
      for (const file of possibleFiles) {
        if (existsSync(file)) {
          actualFile = file;
          // Extract format from extension
          const ext = file.split('.').pop()?.toLowerCase() || 'm4a';
          audioFormat = ext === 'webm' ? 'webm' : ext === 'opus' ? 'opus' : ext === 'ogg' ? 'ogg' : 'm4a';
          break;
        }
      }
      
      if (!actualFile) {
        // Try to find any file with the base name (use timestamp from outputFile)
        const timestamp = outputFile.split('-').pop();
        const files = readdirSync(tempDir).filter((f: string) => 
          f.startsWith(`audio-${timestamp}`) || f.includes(timestamp || '')
        );
        if (files.length > 0) {
          actualFile = join(tempDir, files[0]);
          const ext = files[0].split('.').pop()?.toLowerCase() || 'm4a';
          audioFormat = ext === 'webm' ? 'webm' : ext === 'opus' ? 'opus' : ext === 'ogg' ? 'ogg' : 'm4a';
        } else {
          throw new Error('Audio file not found after extraction');
        }
      }
    } catch (error: any) {
      console.error(`   ❌ Audio extraction error: ${error.message}`);
      throw new Error(`Failed to extract audio: ${error.message}`);
    }
    
    // Read audio file
    const audioBuffer = readFileSync(actualFile);
    
    console.log(`   ✅ Audio extracted: ${audioBuffer.length} bytes, format: ${audioFormat}`);
    
    // Transcribe
    const transcript = await transcribeAudio(audioBuffer, audioFormat);
    
    // Clean up
    try {
      unlinkSync(actualFile);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return transcript;
  } catch (error: any) {
    // Clean up on error - try to find and delete any audio files
    try {
      const timestamp = outputFile.split('-').pop();
      const files = readdirSync(tempDir).filter((f: string) => 
        f.startsWith(`audio-${timestamp}`) || f.includes(timestamp || '')
      );
      files.forEach((f: string) => {
        try {
          unlinkSync(join(tempDir, f));
        } catch (e) {
          // Ignore
        }
      });
    } catch (e) {
      // Ignore cleanup errors
    }
    
    console.error(`   ❌ Video processing failed: ${error.message}`);
    throw error;
  }
}

