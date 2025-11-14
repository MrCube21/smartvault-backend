# Railway Deployment Instructions for SmartVault Backend

## Prerequisites

- GitHub account
- Railway account (sign up at https://railway.app)
- Backend code pushed to a GitHub repository

---

## Step 1: Prepare Your Repository

### Option A: Deploy from Root Directory

If your backend is in `/backend` folder in the root:

1. **Create a separate backend repository** (recommended):
   ```bash
   cd backend
   git init
   git add .
   git commit -m "Initial commit - Railway ready"
   git remote add origin https://github.com/yourusername/smartvault-backend.git
   git push -u origin main
   ```

### Option B: Use Monorepo with Railway

Railway can deploy from a subdirectory:

1. Keep everything in one repo
2. Railway will detect the backend folder
3. Set **Root Directory** to `backend` in Railway settings

---

## Step 2: Create Railway Project

1. **Go to Railway**: https://railway.app
2. **Sign in** with GitHub
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose your repository**:
   - If separate repo: Select `smartvault-backend`
   - If monorepo: Select your main repo, then set root directory to `backend`

---

## Step 3: Configure Build Settings

Railway will auto-detect Node.js, but verify:

1. **Go to Settings** → **Build**
2. **Build Command**: `npm run build` (or leave empty - postinstall handles it)
3. **Start Command**: `npm start` (or leave empty - Procfile handles it)
4. **Root Directory**: `backend` (if monorepo)

Railway will use either:
- **Procfile** (if present) - `web: node dist/index.js`
- **Dockerfile** (if present) - Uses Docker build
- **package.json start script** (fallback)

---

## Step 4: Set Environment Variables

1. **Go to Variables** tab in Railway
2. **Add each variable** from `RAILWAY_ENV_TEMPLATE.md`:

   **Required:**
   ```
   OPENAI_API_KEY=sk-proj-...
   GOOGLE_IOS_CLIENT_ID=481256168241-plsrh8m9h8n79299e2ktho3gtlg38udo.apps.googleusercontent.com
   GOOGLE_WEB_CLIENT_ID=481256168241-b5nnakk88b0kgsien9o8dj79r67elkm7.apps.googleusercontent.com
   JWT_SECRET=<generate with: openssl rand -base64 32>
   NODE_ENV=production
   ```

3. **Generate JWT_SECRET**:
   ```bash
   openssl rand -base64 32
   ```
   Copy the output and paste as `JWT_SECRET` value

4. **Click "Deploy"** to apply changes

---

## Step 5: Deploy

1. Railway will automatically:
   - Install dependencies (`npm install`)
   - Run postinstall script (`npm run build`)
   - Start the server (`node dist/index.js`)

2. **Watch the deployment logs**:
   - Look for: `✅ SmartVault Backend running on...`
   - Check for: `OPENAI_API_KEY: ✅ Set`
   - Verify: `NODE_ENV: production`

3. **If deployment fails**:
   - Check build logs for TypeScript errors
   - Verify all environment variables are set
   - Check that `dist/` folder was created

---

## Step 6: Get Production URL

1. **Go to Settings** → **Networking**
2. **Generate Domain** (or use Railway's default)
3. **Copy the URL** (e.g., `https://smartvault-backend-production.up.railway.app`)

---

## Step 7: Update Mobile App API URL

1. **Open**: `src/api/index.js` in your frontend
2. **Update**:
   ```javascript
   export const API_BASE = 'https://your-railway-url.railway.app';
   ```
   Replace `your-railway-url` with your actual Railway domain

3. **Test the connection**:
   ```bash
   curl https://your-railway-url.railway.app/api/health
   ```
   Should return: `{"status":"ok","message":"SmartVault Backend API"}`

---

## Step 8: Verify Deployment

### Health Check
```bash
curl https://your-railway-url.railway.app/api/health
```

Expected response:
```json
{"status":"ok","message":"SmartVault Backend API"}
```

### Test Google Login Endpoint
```bash
curl -X POST https://your-railway-url.railway.app/api/login/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"test-token"}'
```

Should return an error (expected - token verification will fail), but confirms endpoint is accessible.

---

## Troubleshooting

### Build Fails: "Cannot find module"

**Fix**: Ensure `postinstall` script runs: `npm run build`

### Server Crashes: "OPENAI_API_KEY not set"

**Fix**: 
1. Go to Variables tab
2. Add `OPENAI_API_KEY` with your key
3. Redeploy

### Port Already in Use

**Fix**: Railway sets `PORT` automatically. Don't override it unless needed.

### CORS Errors from Mobile App

**Fix**: CORS is set to `origin: '*'` which should work. If issues persist:
1. Check Railway logs for CORS errors
2. Verify mobile app is using correct API URL
3. Check that `credentials: true` is compatible with your setup

### TypeScript Build Errors

**Fix**:
1. Test build locally: `cd backend && npm run build`
2. Fix any TypeScript errors
3. Commit and push changes
4. Railway will rebuild automatically

---

## Monitoring

### View Logs
1. Go to Railway dashboard
2. Click on your service
3. Click **Logs** tab
4. View real-time logs

### Check Metrics
- **CPU Usage**: Should be low for API server
- **Memory**: Should be stable
- **Requests**: Monitor API usage

---

## Updating the Deployment

### Automatic Updates
- Push to GitHub → Railway auto-deploys
- Changes to `main` branch trigger new deployment

### Manual Deploy
1. Go to Railway dashboard
2. Click **Deploy** button
3. Select commit to deploy

---

## Production Checklist

- [ ] All environment variables set
- [ ] `NODE_ENV=production` is set
- [ ] `JWT_SECRET` is a secure random string
- [ ] `OPENAI_API_KEY` is set and valid
- [ ] Health check endpoint responds
- [ ] Mobile app API URL updated
- [ ] CORS allows mobile app requests
- [ ] Deployment logs show no errors
- [ ] Server starts successfully

---

## Next Steps

After successful deployment:

1. **Update mobile app** with Railway URL
2. **Test Google login** from mobile app
3. **Monitor logs** for any errors
4. **Set up custom domain** (optional)
5. **Enable HTTPS** (Railway provides automatically)

---

## Support

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Check logs** in Railway dashboard for errors

---

**Your backend is now live on Railway! 🚀**

