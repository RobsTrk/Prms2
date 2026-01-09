# Deployment Guide for PRMS+

## Understanding the NOT_FOUND Error

### What Happened?

The `NOT_FOUND` error occurred because:

1. **Hardcoded Localhost URL**: Your frontend was hardcoded to call `http://127.0.0.1:8000`, which only works on your local machine
2. **Missing Vercel Configuration**: No `vercel.json` file existed to tell Vercel how to route requests
3. **Backend Not Deployed**: Your FastAPI backend wasn't deployed anywhere, so API calls failed
4. **Architecture Mismatch**: Vercel primarily hosts static frontends and serverless functions, not full Python applications

### What Was the Code Actually Doing?

- **Expected**: Frontend should connect to a deployed backend API
- **Actual**: Frontend was trying to connect to `localhost:8000` which doesn't exist in production
- **Result**: All API calls (`/login`, `/patients`, etc.) failed with NOT_FOUND

### What Triggered This Error?

- Deploying frontend to Vercel without deploying the backend
- Browser trying to make API calls to non-existent localhost URL
- Vercel having no routing configuration for your static files

---

## Solution: Separate Frontend & Backend Deployment

### Architecture Overview

```
┌─────────────────┐         HTTP/HTTPS          ┌─────────────────┐
│   Vercel        │ ──────────────────────────> │   Backend       │
│   (Frontend)    │                              │   (FastAPI)     │
│   - HTML/CSS/JS │                              │   - Python API  │
│   - Static files│                              │   - SQLite DB   │
└─────────────────┘                              └─────────────────┘
```

### Step 1: Deploy Backend (Choose One Option)

#### Option A: Railway.app (Recommended - Easiest)

1. **Sign up** at [railway.app](https://railway.app)
2. **Create a new project** → "Deploy from GitHub repo"
3. **Add your repo** → Select `BACKEND/main.py` as root
4. **Add environment variables** (if needed)
5. **Railway auto-detects Python** and deploys
6. **Copy the deployment URL** (e.g., `https://your-app.railway.app`)

#### Option B: Render.com

1. Go to [render.com](https://render.com)
2. Create new **Web Service**
3. Connect your GitHub repo
4. Set:
   - **Root Directory**: `BACKEND`
   - **Build Command**: `pip install -r requirements.txt` (create this file)
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Deploy and copy URL

#### Option C: Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. In `BACKEND/` directory: `fly launch`
3. Follow prompts
4. Deploy: `fly deploy`

### Step 2: Update Frontend API URL

After deploying your backend, update `FRONTEND/app.js`:

```javascript
// Replace this line in app.js:
return window.API_BASE_URL || "https://your-backend-url.railway.app";
//                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                          Replace with YOUR actual backend URL
```

**Or use environment variable approach** (see Step 3).

### Step 3: Configure Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add:
   - **Name**: `API_BASE_URL`
   - **Value**: `https://your-backend-url.railway.app`
   - **Environment**: Production, Preview, Development

4. Update `FRONTEND/app.js` to use it:

```javascript
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? "http://127.0.0.1:8000"
    : (window.API_BASE_URL || "https://your-backend-url.railway.app");
```

### Step 4: Create Backend Requirements File

Create `BACKEND/requirements.txt`:

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
pydantic==2.5.0
python-multipart==0.0.6
```

### Step 5: Update Backend for Production

Update `BACKEND/main.py` to allow CORS from your Vercel domain:

```python
# In main.py, update CORS middleware:
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:5500",  # VS Code Live Server
        "https://your-vercel-app.vercel.app",  # Your Vercel URL
        "https://*.vercel.app"  # Or use wildcard for preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Step 6: Deploy Frontend to Vercel

1. **Install Vercel CLI**: `npm i -g vercel`
2. **In project root**: `vercel`
3. **Follow prompts** or push to GitHub and connect via Vercel dashboard

The `vercel.json` file is now configured to serve your frontend correctly.

---

## Alternative: Serverless Functions (Advanced)

If you want to keep everything on Vercel, you'd need to convert your FastAPI backend to Vercel serverless functions. This is more complex and has limitations (cold starts, execution time limits).

**Not recommended** for this use case due to:
- SQLite file system issues on serverless
- Cold start delays
- Complexity of migration

---

## Testing Your Deployment

1. **Test Backend Directly**:
   ```bash
   curl https://your-backend.railway.app/
   # Should return: {"status": "Backend running"}
   ```

2. **Test from Frontend**:
   - Open browser console
   - Check Network tab
   - Look for API calls to your deployed backend URL
   - Verify no CORS errors

3. **Common Issues**:
   - **CORS Error**: Update backend CORS origins
   - **404 on API calls**: Check API_BASE URL in frontend
   - **Database issues**: Backend platforms may need different DB setup (PostgreSQL recommended for production)

---

## Production Considerations

1. **Database**: SQLite won't work well on most platforms. Use:
   - PostgreSQL (Railway, Render, Supabase)
   - Update `SQLALCHEMY_DATABASE_URL` in `main.py`

2. **Environment Variables**: Never commit secrets. Use platform environment variables.

3. **HTTPS**: All platforms provide HTTPS automatically. Update CORS to only allow HTTPS.

4. **Monitoring**: Add error logging (Sentry, LogRocket) for production.

---

## Quick Checklist

- [x] Backend API URL made environment-aware (completed)
- [x] `vercel.json` created for proper routing (completed)
- [x] `requirements.txt` created for backend (completed)
- [x] Emergency endpoint fixed to accept JSON body (completed)
- [ ] Backend deployed and accessible via HTTPS URL (TODO: you need to do this)
- [ ] Frontend API_BASE updated with YOUR actual backend URL
- [ ] CORS configured on backend to allow Vercel domain
- [ ] Tested API endpoints work from deployed backend
- [ ] Tested frontend can connect to deployed backend
- [ ] Environment variables set in Vercel (optional but recommended)

---

## Summary of Changes Made

1. ✅ **Fixed `FRONTEND/app.js`**: Changed hardcoded `localhost:8000` to environment-aware URL detection
2. ✅ **Created `vercel.json`**: Configured proper routing for static files
3. ✅ **Fixed `BACKEND/main.py`**: Emergency endpoint now properly accepts JSON request body
4. ✅ **Created `BACKEND/requirements.txt`**: Required for backend deployment
5. ✅ **Created `DEPLOYMENT.md`**: Complete deployment guide

**Next Steps**: Deploy your backend to Railway/Render/Fly.io and update the API URL in `app.js`!

---

## Need Help?

- **Backend deployment issues**: Check platform docs (Railway/Render/Fly.io)
- **CORS errors**: Verify backend CORS origins include your Vercel URL
- **API not found**: Check browser console for exact URL being called
- **Database issues**: Consider migrating to PostgreSQL for production
