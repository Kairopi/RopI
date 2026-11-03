# FIX "Invalid API key" ERROR - Magic Link Authentication

## Problem
Getting "Invalid API key" error when trying to use magic link authentication.

## Root Cause
Email authentication provider is not enabled in Supabase dashboard.

## Solution - Enable Email Auth in Supabase (2 minutes)

### Step 1: Go to Authentication Settings
1. Open Supabase Dashboard: https://supabase.com/dashboard/project/mvopnwzaatoivybzucwh
2. Click **Authentication** in the left sidebar
3. Click **Providers** tab at the top

### Step 2: Enable Email Provider
1. Find **Email** in the providers list
2. Click to expand the Email provider section
3. Toggle **"Enable Email provider"** to ON (if it's not already)
4. Make sure these settings are configured:
   - ✅ **Enable Email provider**: ON
   - ✅ **Confirm email**: OFF (for faster testing, turn ON for production)
   - ✅ **Enable Email OTP**: ON (this is for magic links)
5. Click **Save** at the bottom

### Step 3: Configure Email Templates (Optional but Recommended)
1. Click **Email Templates** in the Authentication sidebar
2. Select **Magic Link** template
3. You can customize the email, but default works fine
4. Click **Save**

### Step 4: Test Magic Link
1. Go back to http://localhost:5173/
2. Enter your email
3. Click "Use magic link instead"
4. Click "Send magic link"
5. Check your email inbox
6. Click the magic link
7. You should be redirected to the dashboard!

## Additional: Test Password Authentication
1. Click "Use password instead"
2. Enter email and password (min 6 characters)
3. Click "Create account"
4. Check email for confirmation (if email confirmation is enabled)
5. Or sign in directly (if confirmation is disabled)

## Verify Email Settings
Go to: https://supabase.com/dashboard/project/mvopnwzaatoivybzucwh/settings/auth

Make sure:
- ✅ **Site URL**: `http://localhost:5173` (or your production URL)
- ✅ **Redirect URLs**: `http://localhost:5173/**` (wildcard allows all routes)

## Still Having Issues?

### Check API Key
Your `.env` file should have:
```env
VITE_SUPABASE_URL=https://mvopnwzaatoivybzucwh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12b3Bud3phYXRvaXZ5Ynp1Y3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0ODI1NzcsImV4cCI6MjA0NjA1ODU3N30.6sVy9k2RJ7YX9vH-dTMOV8cEWpBSxJRwMGPKuEBi8QY
```

### Restart Dev Server
After making Supabase changes:
```bash
# Stop server (Ctrl+C if running)
npm run dev
```

### Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for any error messages
4. Common errors:
   - "Email not allowed" → Enable email provider
   - "Invalid API key" → Check .env file has correct key
   - "CORS error" → Add your URL to allowed redirect URLs

## Success Indicators

When working correctly:
1. **Magic Link**: "Magic link sent. Check your email." message appears
2. **Sign Up**: "Account created. Check your email to verify." message appears
3. **Sign In**: User is redirected to /dashboard immediately

## Dev Server Status
✅ Server running: http://localhost:5173/
✅ Latest code deployed with responsive fixes
✅ All buttons now 44px minimum height
✅ Touch targets optimized for mobile

---

**After enabling email auth, the magic link should work perfectly!** 🚀
