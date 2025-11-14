// Google/Apple Sign-In authentication

import { OAuth2Client } from 'google-auth-library';
import { storage } from './storage';
import { generateToken } from './jwt';

export interface GoogleUserInfo {
  email: string;
  name: string;
  picture?: string;
}

export interface AppleUserInfo {
  email: string;
  name?: string;
}

// iOS Client ID from LoginScreen.js
// This should match the iosClientId used in the frontend
const GOOGLE_IOS_CLIENT_ID = '481256168241-plsrh8m9h8n79299e2ktho3gtlg38udo.apps.googleusercontent.com';
// Web/Expo Client ID (fallback)
const GOOGLE_WEB_CLIENT_ID = '481256168241-b5nnakk88b0kgsien9o8dj79r67elkm7.apps.googleusercontent.com';

/**
 * Verify Google ID token with Google's servers
 * Validates signature, audience, expiration, and issuer
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
  try {
    // Create OAuth2 client - accept both iOS and Web client IDs
    const client = new OAuth2Client();
    
    // Verify the token - Google will check:
    // - Token signature (using Google's public keys)
    // - Token expiration
    // - Issuer (must be https://accounts.google.com)
    // - Audience (must match one of the provided client IDs)
    const ticket = await client.verifyIdToken({
      idToken,
      audience: [GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID], // Accept both iOS and Web client IDs
    });
    
    const payload = ticket.getPayload();
    
    if (!payload) {
      throw new Error('Invalid token payload: payload is null');
    }
    
    // Verify required fields
    if (!payload.email) {
      throw new Error('Token missing required field: email');
    }
    
    // Extract user information from verified token
    const email = payload.email;
    const name = payload.name || payload.given_name || email.split('@')[0];
    const picture = payload.picture;
    
    // Log successful verification (without sensitive data)
    console.log('✅ Google token verified successfully:', {
      email,
      hasName: !!payload.name,
      hasPicture: !!picture,
      issuer: payload.iss,
      audience: payload.aud,
    });
    
    return {
      email,
      name,
      picture,
    };
  } catch (error: any) {
    console.error('❌ Google token verification failed:', {
      error: error.message,
      code: error.code,
      name: error.name,
    });
    
    // Provide user-friendly error messages
    if (error.message?.includes('Token used too early')) {
      throw new Error('Token is not yet valid. Please check your device clock.');
    }
    if (error.message?.includes('Token used too late')) {
      throw new Error('Token has expired. Please try logging in again.');
    }
    if (error.message?.includes('audience')) {
      throw new Error('Token audience mismatch. Please ensure you are using the correct app.');
    }
    if (error.message?.includes('signature')) {
      throw new Error('Invalid token signature. Token may be corrupted.');
    }
    
    throw new Error(`Google token verification failed: ${error.message || 'Unknown error'}`);
  }
}

// Verify Apple ID token (mock for now)
export async function verifyAppleToken(identityToken: string): Promise<AppleUserInfo> {
  // In production, verify with Apple's servers
  return {
    email: 'user@example.com',
    name: 'Test User',
  };
}

export async function handleGoogleLogin(idToken: string) {
  const googleUser = await verifyGoogleToken(idToken);
  
  // Create or update user
  const [firstName, ...lastNameParts] = googleUser.name.split(' ');
  const user = await storage.upsertUser({
    email: googleUser.email,
    firstName: firstName || null,
    lastName: lastNameParts.join(' ') || null,
    profileImageUrl: googleUser.picture || undefined,
  });

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    email: user.email,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    },
  };
}

export async function handleAppleLogin(identityToken: string, userInfo?: any) {
  const appleUser = await verifyAppleToken(identityToken);
  
  const name = userInfo?.name || appleUser.name || null;
  const [firstName, ...lastNameParts] = (name || '').split(' ');
  
  const user = await storage.upsertUser({
    email: appleUser.email,
    firstName: firstName || null,
    lastName: lastNameParts.join(' ') || null,
  });

  const token = generateToken({
    userId: user.id,
    email: user.email,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    },
  };
}

