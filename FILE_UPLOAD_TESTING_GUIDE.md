# File Upload Feature - Complete Testing Guide

This comprehensive guide walks you through testing the file upload feature from database setup to final testing.

---

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ Docker Desktop installed and running
- ✅ Supabase services running via Docker Compose
- ✅ Node.js and npm installed
- ✅ Project dependencies installed (`npm install`)

---

## 🗄️ Step 1: Database Setup

### 1.1 Start Supabase Services

```bash
# Navigate to supabase directory
cd supabase

# Start all services
docker compose --env-file ../.env up -d

# Return to project root
cd ..
```

### 1.2 Run Database Migrations

```bash
# Apply Prisma schema to database
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### 1.3 Seed Initial Data

```bash
# Populate database with seed data (departments, users, tasks)
npx prisma db seed
```

**What this creates:**

- Default departments (Engineering, HR, etc.)
- Seed users: John Doe, Philip Lee, Sally Loh
- Sample tasks and projects

---

## 🪣 Step 2: Configure Supabase Storage

### 2.1 Create Storage Bucket

1. Open Supabase Dashboard: **http://localhost:8000**
2. Navigate to **Storage** (left sidebar)
3. Click **Create a new bucket**
4. Configure bucket:
   - **Name**: `task-attachments`
   - **Public bucket**: ❌ **Unchecked** (keep it private)
5. Click **Additional Configuration** (expand section)
6. Configure file restrictions:
   - **File size limit**: Click "Reset file upload size for bucket"
   - Enter: `10` (10MB)
   - **Allowed MIME types**: Paste the following:
   ```
   image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip
   ```
7. Click **Create bucket**

### 2.2 Configure Policies

Go to **Storage** → Click `task-attachments` bucket → **Policies** tab → task-attachments > Click **New Policy** > For full customisation

#### Policy 1: Allow Upload (INSERT)

- **Policy Name**: `Users can upload to assigned tasks`
- **Allowed operation**: `INSERT`
- **Target Roles**: Authenticated
- **Policy Definition**:

```sql
bucket_id = 'task-attachments'
AND
(storage.foldername(name))[1] IN (
  SELECT t.id
  FROM task t
  INNER JOIN task_assignment ta ON ta."taskId" = t.id
  WHERE ta."userId" = auth.uid()::text
)
```

Click **Review** → **Save policy**

#### Policy 2: Allow Download (SELECT)

- **Policy Name**: `Users can view files from assigned tasks`
- **Allowed operation**: `SELECT`
- **Target Roles**: `Authenticated`
- **Policy Definition**:

```sql
(bucket_id = 'task-attachments')
AND
(storage.foldername(name))[1] IN (
  SELECT t.id
  FROM task t
  INNER JOIN task_assignment ta ON ta."taskId" = t.id
  WHERE ta."userId" = auth.uid()::text
)
```

Click **Review** → **Save policy**

#### Policy 3: Allow Delete (DELETE)

- **Policy Name**: `Users can delete their own uploaded files`
- **Allowed operation**: `DELETE`
- **Target Roles**: `Authenticated`
- **Policy Definition**:

```sql
(bucket_id = 'task-attachments') AND (owner = uid())
```

Click **Review** → **Save policy**

---

## 👤 Step 3: Create Test User Account

### 3.1 Sign Up via Application

1. Start the development server:

```bash
npm run dev
```

2. Navigate to **http://localhost:3000**
3. Click **Login / Sign Up**
4. Click **Create Account**
5. Fill in the form:
   - **Email**: `test@test.com` (or your choice)
   - **Password**: Choose a secure password
   - **Name**: `Test User` (or your choice)
   - **Department**: Select any department from dropdown

6. Click **Sign Up**

### 3.2 Get Your User ID

After signing up successfully, you need to get your user ID:

#### Option A: Via Supabase Dashboard (Easiest)

1. Go to **http://localhost:8000**
2. Click **Table Editor** (left sidebar)
3. Select **`user_profile`** table
4. Find your email (`test@test.com`)
5. Copy the **`id`** (UUID format) and **`departmentId`**

#### Option B: Via Terminal

```bash
docker exec -i $(docker ps --filter name=supabase-db --format "{{.ID}}") psql -U postgres -d postgres -c "SELECT id, email, name, \"departmentId\" FROM user_profile WHERE email = 'test@test.com';"
```

**Example Output:**

```
                  id                  |     email      |   name    |     departmentId
--------------------------------------+----------------+-----------+---------------------
 75311644-d73e-4d9f-a941-1a729114d9fb | test@test.com  | Test User | dept-consultancy-001
```

**📝 Save these values:**

- **User ID**: `75311644-d73e-4d9f-a941-1a729114d9fb`
- **Department ID**: `dept-consultancy-001`

---

## 📝 Step 4: Configure Test Task SQL

### 4.1 Open SQL Script

Open the file: **`scripts/seed-test-task.sql`**

### 4.2 Update User Information

Find and replace the following placeholders with YOUR values:

#### Line 29 - Owner ID

```sql
'75311644-d73e-4d9f-a941-1a729114d9fb',  -- user ID
```

Replace with **your User ID**

#### Line 30 - Department ID

```sql
'dept-consultancy-001',  -- department ID
```

Replace with **your Department ID**

#### Lines 46-47 - Assignment User IDs

```sql
'75311644-d73e-4d9f-a941-1a729114d9fb',  -- user ID
'75311644-d73e-4d9f-a941-1a729114d9fb',  -- assigned by themselves (for testing)
```

Replace BOTH with **your User ID**

### 4.3 Save the File

After making these changes, **save the file** (`Ctrl+S` or `Cmd+S`)

---

## 🎯 Step 5: Create Test Task in Database

### 5.1 Run SQL Script

1. Go to Supabase Dashboard: **http://localhost:8000**
2. Click **SQL Editor** (left sidebar)
3. Click **New query**
4. Open `scripts/seed-test-task.sql` in your code editor
5. **Copy the entire contents** of the file
6. **Paste into SQL Editor**
7. Click **Run** or press `Ctrl+Enter`

### 5.2 Verify Success

You should see **Result tables**:

#### Table 1: Assignment Created

```
          status              |               task_id                | assigned_user
------------------------------+--------------------------------------+---------------
 ✅ Task assignment created    | 123e4567-e89b-12d3-a456-426614174000 | Test User
```

If you see ✅, you're ready to test!

---

## 🧪 Step 6: Test File Upload Feature

### 6.1 Navigate to Staff Dashboard

1. Ensure dev server is running: `npm run dev`
2. Go to **http://localhost:3000**
3. **Login** with your test account:
   - Email: `test@test.com`
   - Password: (what you set in Step 3)
4. You'll be redirected to **http://localhost:3000/dashboard/staff**

### 6.2 Find the File Upload Section

Scroll down to the bottom of the dashboard page to see:

**📎 My Task - File Upload Test**

You should see:

- Task title: "Test Task for File Upload"
- Task description
- Status and Priority badges
- **Upload Files** section

### 6.3 Test Upload Workflow

#### A. Upload a File ⬆️

1. Click **📁 Choose File** button
2. Select a file from your computer
   - **Max size**: 10MB
   - **Allowed types**: PDF, JPG, PNG, GIF, DOC, DOCX, XLS, XLSX, TXT, ZIP
3. Click **⬆️ Upload** button
4. Watch the **progress bar** (0% → 100%)
5. Success message appears: **✅ File "filename.pdf" uploaded successfully!**

#### B. View Uploaded Files 📋

After upload, the file appears in the uploaded files list showing:

- File name
- File size
- Upload timestamp
- Download and Delete buttons

#### C. Download a File 📥

1. Click **📥 Download** button next to any uploaded file
2. File downloads to your computer

#### D. Delete a File 🗑️

1. Click **🗑️ Delete** button
2. Confirm deletion in the popup
3. File is removed from list and Supabase Storage

---

## ✅ Test Validation & Error Handling

### Test 1: File Size Limit (10MB per file)

**Steps:**

1. Try to upload a file larger than 10MB

**Expected Result:**

```
❌ File size exceeds 10MB limit. Current: 12.34MB
```

### Test 2: Task Size Limit (50MB total)

**Steps:**

1. Upload multiple files
2. Try to exceed 50MB total for the task

**Expected Result:**

```
❌ Task file limit exceeded. Current: 45.00MB, Adding: 8.00MB, Limit: 50MB
```

### Test 3: File Type Restriction

**Steps:**

1. Try to upload an unsupported file type (e.g., `.exe`, `.dmg`)

**Expected Result:**

```
❌ File type "application/x-msdownload" not allowed. Allowed: PDF, images, Word, Excel, text, ZIP
```

### Test 4: Authorization Check

**Steps:**

1. Create another user account
2. Login with that account
3. Try to access the same task

**Expected Result:**

```
❌ No tasks found. (Because the new user isn't assigned to the test task)
```

---

## 🐛 Troubleshooting

### ❌ Error: "Foreign key constraint violated on task_file_taskId_fkey"

**Cause**: The task doesn't exist in the database

**Solution**:

1. Verify you ran Step 5 (Create Test Task)
2. Check Supabase → Table Editor → `task` table
3. Confirm task ID `123e4567-e89b-12d3-a456-426614174000` exists

### ❌ Error: "null value in column 'dueDate' violates not-null constraint"

**Cause**: Missing required field in SQL script

**Solution**:

1. Check `scripts/seed-test-task.sql`
2. Ensure line 27 has: `'2025-12-31T00:00:00.000Z',`
3. Ensure line 30 has your department ID
4. Re-run the SQL script

### ❌ Error: "Unauthorized: You must be assigned to this task to upload files"

**Cause**: User ID mismatch between SQL script and logged-in user

**Solution**:

1. Verify you're logged in as `test@test.com`
2. Check `scripts/seed-test-task.sql` lines 29, 46, 47
3. Ensure all three match YOUR user ID from Step 3.2
4. Re-run the SQL script

### ❌ Error: "No tasks found" on Dashboard

**Cause**: Test task not assigned to logged-in user

**Solution**:

1. Verify SQL script has correct user ID (Step 4)
2. Check database:

```bash
docker exec -i $(docker ps --filter name=supabase-db --format "{{.ID}}") psql -U postgres -d postgres -c "SELECT * FROM task_assignment WHERE \"taskId\" = '123e4567-e89b-12d3-a456-426614174000';"
```

3. Re-run SQL script if assignment is missing

### ❌ Upload fails silently / Files don't appear

**Cause**: RLS policies blocking storage access

**Solution**:

1. Verify bucket name is exactly `task-attachments` (no typos)
2. Re-check all 3 RLS policies (Step 2.2)
3. Ensure column names use PascalCase with quotes: `ta."taskId"`, `ta."userId"`
4. Test policy in Supabase → Storage → Policies → Test policy

---

## 📊 Verify Data in Database

### Check Uploaded Files

```bash
docker exec -i $(docker ps --filter name=supabase-db --format "{{.ID}}") psql -U postgres -d postgres -c "SELECT id, \"fileName\", \"fileSize\", \"fileType\", \"uploadedById\", \"uploadedAt\" FROM task_file WHERE \"taskId\" = '123e4567-e89b-12d3-a456-426614174000';"
```

### Check Task Assignment

```bash
docker exec -i $(docker ps --filter name=supabase-db --format "{{.ID}}") psql -U postgres -d postgres -c "SELECT ta.\"taskId\", ta.\"userId\", u.email, u.name FROM task_assignment ta JOIN user_profile u ON ta.\"userId\" = u.id WHERE ta.\"taskId\" = '123e4567-e89b-12d3-a456-426614174000';"
```

### Check Storage Files (Supabase Dashboard)

1. Go to **http://localhost:8000**
2. Click **Storage** → `task-attachments` bucket
3. Click folder: `123e4567-e89b-12d3-a456-426614174000`
4. Verify uploaded files appear with timestamps

---

## 📁 Implementation File Structure

```
all-in-one/
├── scripts/
│   └── seed-test-task.sql              # ⭐ SQL to create test task
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   └── TaskFileUpload.tsx      # ⭐ Upload UI component (auth-integrated)
│   │   ├── dashboard/
│   │   │   └── staff/
│   │   │       └── page.tsx            # ⭐ Staff dashboard with file upload
│   │   └── server/routers/
│   │       └── taskFile.ts             # ⭐ tRPC endpoints
│   ├── services/
│   │   ├── storage/
│   │   │   └── SupabaseStorageService.ts  # Storage operations
│   │   └── task/
│   │       └── TaskService.ts          # Business logic
│   └── repositories/
│       ├── ITaskRepository.ts          # Repository interface
│       └── PrismaTaskRepository.ts     # Prisma implementation
└── FILE_UPLOAD_TESTING_GUIDE.md       # ⭐ This file
```

---

## 📞 Need Help?

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Verify all environment variables in `.env`
3. Check Docker logs: `docker logs <container-id>`
4. Check Next.js console for errors
5. Check Supabase Dashboard → Logs

---

**Last Updated**: 2025-10-06
**Feature Branch**: `SCRUM-46-feat-file-attachments-upload`
**Test Task ID**: `123e4567-e89b-12d3-a456-426614174000`
