# GymBuddy Authentication Setup Guide

This guide will walk you through adding authentication to your GymBuddy app.

## Overview

Authentication has been added with the following features:
- User signup and login with email/password
- Secure user-specific data isolation
- Protected routes requiring authentication
- Automatic filtering of workouts and exercises by user

## Step-by-Step Setup

### 1. Update Your Supabase Database

You need to run the authentication migration SQL in your Supabase project.

**In your Supabase Dashboard:**

1. Go to the SQL Editor (icon on the left sidebar)
2. Click "New Query"
3. Copy the entire contents of `supabase-auth-migration.sql`
4. Paste it into the SQL editor
5. Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)

This will:
- Remove the old public access policies
- Add `user_id` columns to `workouts` and `exercises` tables
- Create user-specific Row Level Security (RLS) policies
- Create indexes for performance

### 2. Enable Email Authentication in Supabase

**In your Supabase Dashboard:**

1. Go to **Authentication** (in the left sidebar)
2. Click on **Providers**
3. Make sure **Email** is enabled (it should be by default)
4. **For Development ONLY**: Disable email confirmation
   - Go to **Authentication** → **Settings** → **Auth Settings**
   - Find "Confirm email" toggle
   - Turn it **OFF** (this allows instant signup for testing)
   - **Note**: Re-enable this in production!

### 3. Restart Your Development Server

The dev server should already be running, but if you need to restart:

```bash
npm run dev
```

### 4. Test Authentication

Now you can test the authentication flow:

1. **Navigate to http://localhost:5173**
   - You should be redirected to `/login` since you're not authenticated

2. **Create an Account**
   - Click "Sign up" link
   - Enter an email and password (minimum 6 characters)
   - If email confirmation is disabled, you'll be logged in immediately
   - If not, check your email for confirmation

3. **Import Sample Data**
   - Once logged in, go to the Import page
   - Upload or paste the `sample-workout.csv` file
   - Data will be imported with your user_id

4. **View Your Workouts**
   - Go to Calendar page
   - You should see the imported workouts
   - These workouts are only visible to you

5. **Test Data Isolation**
   - Create another account in a private/incognito window
   - Import different workouts
   - Verify that each user only sees their own data

6. **Test Logout**
   - Click the "Logout" button in the navigation
   - You should be redirected back to login

## What Changed

### Database Structure

**Before:**
- Workouts and exercises were public (anyone could see/edit)
- No user association

**After:**
- Each workout has a `user_id` field
- Each exercise has a `user_id` field
- RLS policies ensure users only see their own data

### Application Structure

**New Files:**
- `src/contexts/AuthContext.tsx` - Authentication state management
- `src/components/ProtectedRoute.tsx` - Route protection wrapper
- `src/pages/LoginPage.tsx` - Login UI
- `src/pages/SignupPage.tsx` - Registration UI
- `supabase-auth-migration.sql` - Database migration for auth

**Modified Files:**
- `src/App.tsx` - Added AuthProvider and protected routes
- `src/pages/ImportPage.tsx` - Added user_id when creating workouts/exercises
- `src/lib/database.types.ts` - Updated types to include user_id

### Security

- **Row Level Security (RLS)**: Automatically filters all database queries
- **No code changes needed**: CalendarPage and WorkoutPage automatically filter by user
- **Automatic isolation**: Users cannot access each other's data even if they know workout IDs

## Troubleshooting

### "Invalid claims" or "JWT" errors
- Your Supabase anon key might be wrong
- Check `.env` file has the correct `VITE_SUPABASE_ANON_KEY`
- Make sure you're using the **anon key**, not the service_role key

### Can't login after signup
- Email confirmation might be enabled
- Go to Supabase → Authentication → Settings → Disable "Confirm email"
- Or check your email for confirmation link

### Old data not visible
- Data created before migration doesn't have user_id
- Either:
  - Delete old data from Supabase dashboard
  - Or manually update old rows to add your user_id:
    ```sql
    -- Get your user ID from Supabase Auth → Users
    UPDATE workouts SET user_id = 'your-user-id-here';
    UPDATE exercises SET user_id = 'your-user-id-here';
    ```

### Import fails with "violates foreign key constraint"
- Make sure you're logged in
- The user object must exist before importing
- Check browser console for specific errors

## Next Steps

Once authentication is working:

1. **Deploy to Production**
   - Re-enable email confirmation in Supabase
   - Set up email templates for confirmation and password reset
   - Deploy frontend to Vercel, Netlify, or your preferred host

2. **Optional Enhancements**
   - Add OAuth providers (Google, GitHub, etc.)
   - Add password reset flow
   - Add user profile page
   - Add email change functionality

## Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Check Supabase logs (Dashboard → Logs)
3. Verify your `.env` file has correct credentials
4. Make sure both SQL files were run successfully
