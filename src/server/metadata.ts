// Webpage metadata extraction

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export interface Metadata {
  title: string;
  description: string | null;
  imageUrl: string | null;
}

export async function extractMetadata(url: string): Promise<Metadata> {
  try {
    // Fetch webpage with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SmartVault/1.0; +https://smartvault.app)',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    let title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() ||
                new URL(url).hostname;

    // Extract description
    const description = $('meta[property="og:description"]').attr('content') ||
                       $('meta[name="twitter:description"]').attr('content') ||
                       $('meta[name="description"]').attr('content') ||
                       null;

    // Extract image
    let imageUrl = $('meta[property="og:image"]').attr('content') ||
                   $('meta[name="twitter:image"]').attr('content') ||
                   $('meta[name="twitter:image:src"]').attr('content') ||
                   null;

    // Convert relative URLs to absolute
    if (imageUrl && !imageUrl.startsWith('http')) {
      try {
        const baseUrl = new URL(url);
        imageUrl = new URL(imageUrl, baseUrl).href;
      } catch {
        imageUrl = null;
      }
    }

    // Clean up title
    title = title.trim().replace(/\s+/g, ' ');

    return {
      title: title || new URL(url).hostname,
      description: description ? description.trim() : null,
      imageUrl,
    };
  } catch (error) {
    // Fallback to URL-based metadata
    const urlObj = new URL(url);
    return {
      title: urlObj.hostname,
      description: null,
      imageUrl: null,
    };
  }
}

