"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Users, Shield, User, Trash2, UserPlus, AlertTriangle } from 'lucide-react';
import CreateUserForm from './create-user-form';

interface UserProfile {
  id: string;
  email: string;
  role: 'super_admin' | 'user';
  created_at: string;
  last_sign_in_at: string | null;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const { isSuperAdmin } = useAuth();

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        setError(error.message);
        return;
      }

      const userProfiles: UserProfile[] = data.users.map(user => ({
        id: user.id,
        email: user.email || '',
        role: (user.user_metadata?.role as 'super_admin' | 'user') || 'user',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || null,
      }));

      setUsers(userProfiles);
    } catch {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'super_admin' | 'user') => {
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { role: newRole }
      });

      if (error) {
        setError(error.message);
        return;
      }

      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
    } catch {
      setError('Failed to update user role');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) {
        setError(error.message);
        return;
      }

      // Remove from local state
      setUsers(prev => prev.filter(user => user.id !== userId));
    } catch {
      setError('Failed to delete user');
    }
  };

  if (!isSuperAdmin) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You need super admin privileges to access user management.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Users className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <CreateUserForm 
                onSuccess={() => {
                  setCreateUserOpen(false);
                  fetchUsers();
                }}
                onCancel={() => setCreateUserOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={fetchUsers} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{user.email}</CardTitle>
                    <CardDescription>
                      Created: {new Date(user.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={user.role === 'super_admin' ? 'default' : 'secondary'}>
                    {user.role === 'super_admin' ? (
                      <>
                        <Shield className="w-3 h-3 mr-1" />
                        Super Admin
                      </>
                    ) : (
                      'User'
                    )}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Last sign in: {user.last_sign_in_at 
                    ? new Date(user.last_sign_in_at).toLocaleDateString()
                    : 'Never'
                  }
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateUserRole(
                      user.id, 
                      user.role === 'super_admin' ? 'user' : 'super_admin'
                    )}
                  >
                    {user.role === 'super_admin' ? 'Remove Admin' : 'Make Admin'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteUser(user.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
