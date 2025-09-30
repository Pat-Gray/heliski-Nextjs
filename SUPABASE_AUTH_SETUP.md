# Supabase Authentication Setup Guide

## 1. Supabase Project Configuration

### Enable Authentication
1. Go to your Supabase project dashboard
2. Navigate to Authentication > Settings
3. Enable Email authentication
4. Configure your site URL (e.g., `http://localhost:3000` for development)

### Set up Row Level Security (RLS)
1. Go to Authentication > Policies
2. Create policies for your tables to allow authenticated users to access data

### User Roles Setup
The application uses two user roles:
- `super_admin`: Full access to all features including user management
- `user`: Standard access to run data and daily plans

## 2. Environment Variables

Make sure your `.env.local` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Database Schema Updates

You may need to add a `role` field to your user metadata. This is handled automatically by the signup process.

## 4. Initial Setup

### First Time Setup
1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3000/setup`
3. Create your first super admin account
4. You'll be redirected to the login page
5. Sign in with your super admin credentials

### Creating Additional Users
1. Sign in as a super admin
2. Navigate to `/admin/users` (or use the "User Management" link in the sidebar)
3. Click "Create User" to add new users
4. Set their role (User or Super Admin)
5. Users can then sign in with their credentials

## 5. Testing the Authentication

1. Test login with different user roles
2. Test password reset functionality
3. Test user management as super admin
4. Test role-based access control

## 6. User Management

Super admins can:
- View all users
- Change user roles
- Delete users
- Create new users with passwords
- Access the admin panel at `/admin/users`

## 7. Security Features

- All pages are protected by authentication
- Role-based access control
- Automatic redirects for unauthorized access
- Secure session management
- User-friendly error handling
- Admin-only user creation
- Password reset functionality

## 8. Troubleshooting

### Common Issues:
1. **"Missing Supabase environment variables"**: Check your `.env.local` file
2. **Authentication not working**: Verify your Supabase project settings
3. **Role not updating**: Check user metadata in Supabase dashboard
4. **Redirect loops**: Ensure your site URL is correctly configured in Supabase

### Debug Steps:
1. Check browser console for errors
2. Verify Supabase project is active
3. Check network tab for failed requests
4. Ensure all environment variables are set correctly
