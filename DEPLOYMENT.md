# Backend Deployment Guide

## ✅ Current Configuration Status

Your backend is properly configured for deployment with the following features:

### 1. CORS Configuration ✅
- Allows requests from `localhost:3000`, `localhost:3001`, and your deployed frontend
- Supports credentials and proper headers
- Includes both `http://` and `https://` origins

### 2. Port Configuration ✅
- Server listens on `process.env.PORT || 5000`
- Compatible with Render, Railway, Heroku, and other platforms

### 3. API Routes ✅
- All routes properly prefixed with `/api`
- Authentication routes: `/api/register`, `/api/login`, `/api/auth/google`
- Chat routes: `/api/chat`, `/api/public-chat`
- File analysis: `/api/analyze-file`, `/api/analyze-image`

### 4. Health Check Endpoint ✅
- New `/api/health` endpoint for testing connectivity
- Returns server status, timestamp, and environment info

## 🚀 Deployment Steps

### 1. Environment Variables
Make sure these are set in your deployment platform:

```env
# Required
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# API Keys
GEMINI_API_KEY=your_gemini_api_key
IMAGE_API_KEY=your_openai_api_key

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password

# OAuth (Google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# URLs
FRONTEND_URL=https://your-frontend-domain.com
BACKEND_URL=https://your-backend-domain.com
GOOGLE_CALLBACK_URL=https://your-backend-domain.com/api/auth/google/callback

# Environment
NODE_ENV=production
```

### 2. Testing Your Deployment

#### Test Health Endpoint
```bash
curl https://your-backend-domain.com/api/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Backend server is running",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "production",
  "port": 5000
}
```

#### Test CORS from Local Frontend
```bash
# Test preflight request
curl -X OPTIONS https://your-backend-domain.com/api/health \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type"
```

#### Run Backend Test Script
```bash
cd backend
node test_backend.js
```

## 🔧 Troubleshooting

### Issue: "path-to-regexp TypeError"
If you see this error during deployment:
```
TypeError: Missing parameter name at 1: https://git.new/pathToRegexpError
```

**Solution:** This is fixed by:
1. Using Express 4.18.2 instead of Express 5.x
2. Using proper 404 handler syntax: `app.use((req, res) => {...})` instead of `app.use('*', ...)`

### Issue: "No response from backend"
1. **Check if backend is running:**
   ```bash
   curl https://your-backend-domain.com/api/health
   ```

2. **Check CORS configuration:**
   - Ensure `localhost:3000` is in the allowed origins
   - Check browser console for CORS errors

3. **Check environment variables:**
   - Verify all required env vars are set in deployment platform
   - Check MongoDB connection string

4. **Check logs:**
   - View deployment platform logs for errors
   - Look for connection issues or missing dependencies

### Issue: "CORS error in browser"
1. **Frontend configuration:**
   - Set `REACT_APP_BACKEND_URL` in frontend `.env.local`:
   ```env
   REACT_APP_BACKEND_URL=https://your-backend-domain.com
   ```

2. **Backend CORS:**
   - Verify `localhost:3000` is in allowed origins
   - Check that credentials are enabled

### Issue: "Authentication not working"
1. **Check JWT configuration:**
   - Verify `JWT_SECRET` is set
   - Check token expiration settings

2. **Check OAuth configuration:**
   - Verify Google OAuth credentials
   - Check callback URL matches deployment URL

## 📝 Frontend Configuration

Create a `.env.local` file in your frontend directory:

```env
REACT_APP_BACKEND_URL=https://your-backend-domain.com
```

Then restart your frontend development server:
```bash
cd frontend
npm start
```

## 🧪 Testing Checklist

- [ ] Health endpoint returns 200 OK
- [ ] CORS preflight requests work
- [ ] Authentication endpoints respond
- [ ] Chat endpoints work
- [ ] File upload endpoints work
- [ ] Frontend can connect from localhost:3000

## 📞 Support

If you're still having issues:
1. Check deployment platform logs
2. Verify all environment variables are set
3. Test with the provided `test_backend.js` script
4. Check browser network tab for specific error details
