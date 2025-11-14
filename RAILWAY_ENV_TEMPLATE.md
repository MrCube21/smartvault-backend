# Railway Environment Variables Template

## Required Environment Variables

Copy these into your Railway project's environment variables section:

```bash
# OpenAI API Key (Required for AI features)
OPENAI_API_KEY=sk-proj-...

# Google OAuth Client IDs (Required for Google Login)
GOOGLE_IOS_CLIENT_ID=481256168241-plsrh8m9h8n79299e2ktho3gtlg38udo.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_ID=481256168241-b5nnakk88b0kgsien9o8dj79r67elkm7.apps.googleusercontent.com

# JWT Secret (Required for authentication)
# Generate a secure random string: openssl rand -base64 32
JWT_SECRET=your-secure-random-secret-here

# Node Environment
NODE_ENV=production

# Port (Railway sets this automatically, but you can override)
PORT=3000
```

## Optional Environment Variables

```bash
# JWT Expiry (default: 30d)
JWT_EXPIRY=30d

# Apple Sign-In (if using Apple login)
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
```

## How to Set in Railway

1. Go to your Railway project dashboard
2. Click on your service
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add each variable from the template above
6. Click **Deploy** to apply changes

## Security Notes

- **Never commit** `.env` files to Git
- **JWT_SECRET** should be a long, random string (use `openssl rand -base64 32`)
- **OPENAI_API_KEY** should be kept secret
- Railway automatically provides **PORT** - you don't need to set it manually

## Verification

After setting variables, check the deployment logs for:

```
📋 Environment Check:
   NODE_ENV: production
   PORT: 3000
   OPENAI_API_KEY: ✅ Set (XX chars)
```

If you see `❌ NOT SET` for OPENAI_API_KEY, the variable wasn't set correctly.

