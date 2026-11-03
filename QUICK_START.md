# ⚡ QUICK START - DO THIS NOW!

## 🔑 STEP 1: GET YOUR ANON KEY (2 minutes)

1. **Go to:** https://supabase.com/dashboard/project/mvopnwzaatoivybzucwh/settings/api

2. **Find "Project API keys" section**

3. **Copy the "anon public" key** (NOT the service_role!)
   - It starts with `eyJhbGci...`
   - This is the PUBLIC key (safe for frontend)

4. **Paste it in .env file:**
   - Open: `ropi/.env`
   - Replace `PASTE_YOUR_ANON_PUBLIC_KEY_HERE` with your key
   - Save file

---

## 🗄️ STEP 2: CREATE DATABASE (5 minutes)

1. **Go to SQL Editor:**
   https://supabase.com/dashboard/project/mvopnwzaatoivybzucwh/sql/new

2. **Copy the entire SQL file:**
   - Open: `ropi/supabase-schema.sql`
   - Select all (Ctrl+A)
   - Copy (Ctrl+C)

3. **Paste in Supabase SQL Editor:**
   - Paste (Ctrl+V)
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for success message

4. **Verify tables created:**
   - Go to Table Editor: https://supabase.com/dashboard/project/mvopnwzaatoivybzucwh/editor
   - You should see 24 tables!

---

## 🔐 STEP 3: ENABLE AUTH (1 minute)

1. **Go to Authentication:**
   https://supabase.com/dashboard/project/mvopnwzaatoivybzucwh/auth/providers

2. **Enable Email provider:**
   - Find "Email" in the list
   - Toggle it ON
   - Click "Save"

---

## ✅ STEP 4: TEST CONNECTION (1 minute)

```bash
# Restart dev server
# Press Ctrl+C in the terminal running npm run dev
# Then start again:
cd ropi
npm run dev
```

Open browser: http://localhost:5173

Check console (F12) - should see no errors!

---

## 🎉 DONE!

You should now have:
- ✅ GitHub repo: https://github.com/Kairopi/RopI
- ✅ Supabase project: https://supabase.com/dashboard/project/mvopnwzaatoivybzucwh
- ✅ 24 tables created
- ✅ Auth enabled
- ✅ .env configured
- ✅ Dev server running

**NEXT:** We start building the UI! (Hour 4-6: Auth + Layout)

---

## 📋 CHECKLIST

- [ ] Got anon public key from Supabase
- [ ] Updated .env file with the key
- [ ] Ran supabase-schema.sql in SQL Editor
- [ ] Verified 24 tables exist in Table Editor
- [ ] Enabled Email auth
- [ ] Restarted dev server
- [ ] No errors in browser console

**When all checked, tell me: "Setup complete!"**
