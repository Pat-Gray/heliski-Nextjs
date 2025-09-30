# User Management Guide

## Overview
This application uses Supabase for authentication with two user roles:
- **super_admin**: Full access to all features including user management
- **user**: Standard access to dashboard and run management

## Database Schema Setup

### 1. User Roles Table
You need to create a user roles table in your Supabase database to store user roles:

```sql
-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create function to handle new user role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'user'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.user_roles 
    WHERE user_roles.user_id = get_user_role.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.user_roles TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO anon, authenticated;
```

### 2. Row Level Security (RLS)
Enable RLS on the user_roles table:

```sql
-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own role
CREATE POLICY "Users can read their own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for super admins to read all roles
CREATE POLICY "Super admins can read all roles" ON public.user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );
```

## Creating Users

### Method 1: Through the Application (Recommended)
1. **Login as Super Admin**: Use your super admin account
2. **Navigate to User Management**: Go to `/admin/users` in the application
3. **Create New User**: Click "Create User" button
4. **Fill Form**: Enter email, password, and select role
5. **Submit**: User will be created with the selected role

### Method 2: Direct Database Insert
```sql
-- Insert a new user role (after user is created in auth.users)
INSERT INTO public.user_roles (user_id, role)
VALUES ('user-uuid-here', 'user');
```

### Method 3: Using Supabase Admin API
```javascript
// This is what the createUser function does in the app
const { data, error } = await supabase.auth.admin.createUser({
  email: 'user@example.com',
  password: 'securepassword',
  user_metadata: { role: 'user' },
  email_confirm: true,
});
```

## Password Reset Flow

### Fixed Issues:
1. **Redirect Loop**: Fixed by creating separate `/auth/reset-password-confirm` page
2. **Password Update**: Users can now actually update their password after clicking reset link
3. **Session Handling**: Proper session validation and error handling

### How it works:
1. User requests password reset at `/auth/reset-password`
2. Email sent with link to `/auth/reset-password-confirm`
3. User clicks link and is taken to password update form
4. After successful update, user is redirected to login

## Testing the Setup

### 1. Test Super Admin Creation
```bash
# Go to /setup page and create your super admin
# This should work if you haven't created one yet
```

### 2. Test User Creation
1. Login as super admin
2. Go to `/admin/users`
3. Click "Create User"
4. Fill in details and create a regular user
5. Test login with the new user

### 3. Test Password Reset
1. Go to `/auth/reset-password`
2. Enter an existing user's email
3. Check email for reset link
4. Click link and update password
5. Test login with new password

## Troubleshooting

### Common Issues:

1. **"Insufficient permissions" error when creating users**
   - Make sure you're logged in as super_admin
   - Check that the user_roles table exists
   - Verify RLS policies are set up correctly

2. **Password reset not working**
   - Check Supabase email settings
   - Verify redirect URL is correct
   - Check browser console for errors

3. **User roles not persisting**
   - Check that the trigger function is created
   - Verify user_metadata is being set correctly
   - Check user_roles table for entries

### Database Verification Queries:
```sql
-- Check if user_roles table exists
SELECT * FROM information_schema.tables WHERE table_name = 'user_roles';

-- Check user roles
SELECT u.email, ur.role 
FROM auth.users u 
LEFT JOIN public.user_roles ur ON u.id = ur.user_id;

-- Check if trigger exists
SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';
```

## Security Notes

1. **Super Admin Access**: Only super admins can create new users
2. **Role Validation**: Roles are validated at database level
3. **Session Security**: Password reset sessions are properly validated
4. **RLS Protection**: User roles are protected by row-level security

## Next Steps

1. Run the SQL commands above in your Supabase SQL editor
2. Test user creation through the admin interface
3. Test password reset flow
4. Create additional users as needed for your team
