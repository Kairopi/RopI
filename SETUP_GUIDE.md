# 🚀 ROPI SETUP GUIDE
## Connect to GitHub + Supabase

**Current Status:** Git initialized locally, need to push to GitHub + create Supabase project

---

## 📋 STEP 1: CREATE GITHUB REPOSITORY

### **Option A: Using GitHub CLI (Recommended)**

```bash
# Install GitHub CLI if not installed
# Download from: https://cli.github.com/

# Login to GitHub
gh auth login

# Create repository
cd ropi
gh repo create ropi-hackathon-2026 --public --source=. --remote=origin --push

# Done! Your repo is live at: https://github.com/YOUR_USERNAME/ropi-hackathon-2026
```

### **Option B: Using GitHub Website**

1. **Go to GitHub:**
   - Open https://github.com/new
   - Repository name: `ropi-hackathon-2026`
   - Description: "ROPI - AI Life Operating System (Meta Hackathon 2026)"
   - Public repository ✅
   - **DO NOT** initialize with README (we already have one)
   - Click "Create repository"

2. **Connect Local to GitHub:**
   ```bash
   cd ropi
   git remote add origin https://github.com/YOUR_USERNAME/ropi-hackathon-2026.git
   git branch -M main
   git push -u origin main
   ```

3. **Verify:**
   - Refresh GitHub page
   - You should see all files (README.md, TASKS.md, src/, etc.)

---

## 🗄️ STEP 2: CREATE SUPABASE PROJECT

### **2.1: Create Project**

1. **Go to Supabase:**
   - Open https://supabase.com/dashboard
   - Click "New project"

2. **Project Settings:**
   - Organization: Select yours (or create one)
   - Name: `ropi-hackathon-2026`
   - Database Password: **SAVE THIS!** (You'll need it)
   - Region: Choose closest to you (e.g., US East, Europe West)
   - Pricing Plan: Free (sufficient for hackathon)
   - Click "Create new project"

3. **Wait for Setup:**
   - Takes ~2 minutes
   - You'll see "Setting up your project..."

### **2.2: Get API Credentials**

1. **Open Project Settings:**
   - Click your project name
   - Go to Settings (⚙️) → API

2. **Copy Credentials:**
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public key:** `eyJhbGci...` (long string)

3. **Create .env File:**
   ```bash
   # In the ropi folder
   # Copy .env.example to .env
   cp .env.example .env
   
   # Edit .env and add:
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

### **2.3: Create Database Schema**

1. **Open SQL Editor:**
   - In Supabase Dashboard
   - Click "SQL Editor" (left sidebar)
   - Click "New query"

2. **Copy Schema:**
   - Open `FINAL_REQUIREMENTS_2026.md` in your editor
   - Scroll to database schema section (search for "CREATE TABLE")
   - Copy ALL 24 table definitions

3. **Alternative - Use This Schema:**

```sql
-- USER CONTEXT
CREATE TABLE user_context (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  goals JSONB,
  constraints JSONB,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SCHEDULING
CREATE TABLE time_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  task_id UUID,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  block_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE availability_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  day_of_week INTEGER,
  start_time TIME,
  end_time TIME,
  window_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  event_type TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE replan_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  trigger TEXT,
  before_schedule JSONB,
  after_schedule JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scheduling_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  conflict_type TEXT,
  description TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- JOB APPLICATIONS
CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  job_url TEXT,
  description TEXT,
  requirements TEXT,
  match_score INTEGER,
  ats_score INTEGER,
  status TEXT DEFAULT 'discovered',
  applied_at TIMESTAMPTZ,
  interview_date TIMESTAMPTZ,
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  version TEXT NOT NULL,
  content JSONB,
  tailored_for UUID REFERENCES job_applications,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cover_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  job_application_id UUID REFERENCES job_applications,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recruiters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE company_watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  company TEXT NOT NULL,
  ats_url TEXT,
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEARNING
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  topic TEXT NOT NULL,
  title TEXT,
  content TEXT,
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  lesson_id UUID REFERENCES lessons,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  time_spent_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE concept_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  options JSONB,
  difficulty INTEGER DEFAULT 0,
  due_date TIMESTAMPTZ,
  fsrs_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE review_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  card_id UUID REFERENCES concept_cards,
  answer TEXT,
  correct BOOLEAN,
  time_taken_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KNOWLEDGE
CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT,
  content TEXT,
  source TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AGENT SYSTEM
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER,
  deadline TIMESTAMPTZ,
  estimated_duration INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_intentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  agent_name TEXT,
  intention TEXT,
  reasoning TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE verified_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  action_type TEXT,
  action_target TEXT,
  evidence JSONB,
  screenshot_url TEXT,
  confirmation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  activity_type TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE action_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  intent_description TEXT,
  intent_reason TEXT,
  action_type TEXT,
  action_target TEXT,
  permission_decision TEXT,
  success BOOLEAN,
  extracted_data JSONB,
  before_screenshot TEXT,
  after_screenshot TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  workspace_mode TEXT DEFAULT 'ask',
  action_rules JSONB,
  site_rules JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE control_handoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  agent_name TEXT,
  blocker_type TEXT,
  help_requested_at TIMESTAMPTZ,
  control_released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  topic TEXT,
  score INTEGER,
  total_questions INTEGER,
  weak_spots TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE replan_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can access own data" ON user_context FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON time_blocks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON availability_windows FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON calendar_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON replan_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON scheduling_conflicts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON job_applications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON cover_letters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON recruiters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON company_watchlists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON lessons FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON lesson_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON concept_cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON review_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON knowledge_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON agent_intentions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON verified_actions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON activity_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON action_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON agent_permissions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON control_handoffs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON quiz_attempts FOR ALL USING (auth.uid() = user_id);
```

4. **Run Query:**
   - Click "Run" (or press Ctrl+Enter)
   - Wait for success message
   - You should see "Success. No rows returned"

5. **Verify Tables:**
   - Click "Table Editor" (left sidebar)
   - You should see all 24 tables listed

### **2.4: Enable Authentication**

1. **Go to Authentication:**
   - Click "Authentication" (left sidebar)
   - Click "Providers"

2. **Enable Email:**
   - Find "Email" provider
   - Toggle it ON
   - Click "Save"

3. **Configure Email Templates (Optional):**
   - Click "Email Templates"
   - Customize signup/login emails if desired

---

## ✅ STEP 3: TEST CONNECTION

### **3.1: Update .env File**

```bash
# Make sure .env exists with your credentials
cat .env

# Should show:
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### **3.2: Test Frontend Connection**

```bash
# Dev server should still be running
# If not, start it:
npm run dev

# Open browser: http://localhost:5173
# Open browser console (F12)
```

### **3.3: Test Supabase Connection**

Create a test file:

```bash
# Create test file
echo 'import { supabase } from "./src/lib/supabase";
console.log("Testing Supabase connection...");
supabase.from("user_context").select("*").then(
  data => console.log("✅ Supabase connected!", data),
  error => console.error("❌ Supabase error:", error)
);' > test-supabase.js
```

Or manually test in browser console:
```javascript
// Paste in browser console
import { supabase } from './src/lib/supabase.ts';
const { data, error } = await supabase.from('user_context').select('*');
console.log('Connection test:', { data, error });
```

---

## 🎉 STEP 4: COMMIT & PUSH

```bash
# Add .env to .gitignore (already done)
# Commit setup changes
git add .
git commit -m "Setup complete: Supabase connected"
git push origin main
```

---

## 📊 VERIFICATION CHECKLIST

### **GitHub:**
- [ ] Repository created at github.com/YOUR_USERNAME/ropi-hackathon-2026
- [ ] All files visible (README, TASKS, src/, etc.)
- [ ] Can clone and pull changes

### **Supabase:**
- [ ] Project created: ropi-hackathon-2026
- [ ] All 24 tables exist in Table Editor
- [ ] Row Level Security enabled
- [ ] Email auth enabled
- [ ] API credentials copied to .env

### **Local:**
- [ ] .env file exists with correct credentials
- [ ] Dev server running at http://localhost:5173
- [ ] Can access Supabase from frontend (no errors in console)
- [ ] Git remote connected to GitHub

---

## 🚨 TROUBLESHOOTING

### **GitHub Issues:**

**"Repository already exists"**
- Choose different name: `ropi-hackathon-2026-v2`
- Or delete existing repo and recreate

**"Permission denied (publickey)"**
- Use HTTPS instead of SSH
- Or set up SSH keys: https://docs.github.com/en/authentication

### **Supabase Issues:**

**"No rows returned" error**
- This is normal! Tables are empty at first
- Try inserting test data

**"Row Level Security policy violation"**
- You need to be logged in as a user
- Test with auth disabled temporarily, or create a test user

**"Cannot connect to Supabase"**
- Check .env variables are correct
- Make sure VITE_ prefix is there
- Restart dev server after changing .env

### **Dev Server Issues:**

**"Port 5173 already in use"**
```bash
# Kill existing process
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Or use different port
npm run dev -- --port 5174
```

---

## 🚀 NEXT STEPS

Once everything is connected:

1. **Update STATUS.md**
   - Mark "Hour 2-4: Supabase Setup" as complete

2. **Start Hour 4-6: Auth + Layout**
   - Build login page
   - Create dashboard layout
   - Test auth flow

3. **Push changes regularly**
   ```bash
   git add .
   git commit -m "Feature: description"
   git push origin main
   ```

---

## 📝 QUICK REFERENCE

**GitHub Repo:** https://github.com/YOUR_USERNAME/ropi-hackathon-2026  
**Supabase Dashboard:** https://supabase.com/dashboard/project/YOUR_PROJECT_ID  
**Local Dev:** http://localhost:5173  
**Docs:** TASKS.md, DESIGN_SYSTEM.md, STATUS.md

---

**✅ READY TO BUILD! LET'S GO! 🚀**
