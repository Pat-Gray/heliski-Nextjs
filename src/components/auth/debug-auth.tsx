"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function DebugAuth() {
  const { user, isSuperAdmin, isAuthenticated, loading, updateUserRole } = useAuth();
  const [updating, setUpdating] = useState(false);

  const handleUpdateRole = async (newRole: 'user' | 'super_admin') => {
    setUpdating(true);
    const { error } = await updateUserRole(newRole);
    if (error) {
      console.error('Error updating role:', error);
      alert('Error updating role: ' + error.message);
    } else {
      alert('Role updated successfully!');
    }
    setUpdating(false);
  };

  if (loading) {
    return <div>Loading auth debug...</div>;
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Auth Debug Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <strong>Is Authenticated:</strong> 
          <Badge variant={isAuthenticated ? "default" : "destructive"} className="ml-2">
            {isAuthenticated ? "Yes" : "No"}
          </Badge>
        </div>
        
        <div>
          <strong>Is Super Admin:</strong> 
          <Badge variant={isSuperAdmin ? "default" : "secondary"} className="ml-2">
            {isSuperAdmin ? "Yes" : "No"}
          </Badge>
        </div>

        {user && (
          <div className="space-y-2">
            <div>
              <strong>User ID:</strong> {user.id}
            </div>
            <div>
              <strong>Email:</strong> {user.email}
            </div>
            <div>
              <strong>Role (direct):</strong> {user.role || 'undefined'}
            </div>
            <div>
              <strong>User Metadata:</strong>
              <pre className="bg-gray-100 p-2 rounded text-xs mt-1">
                {JSON.stringify(user.user_metadata, null, 2)}
              </pre>
            </div>
            <div>
              <strong>App Metadata:</strong>
              <pre className="bg-gray-100 p-2 rounded text-xs mt-1">
                {JSON.stringify(user.app_metadata, null, 2)}
              </pre>
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-2">Fix Role (if needed):</h4>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleUpdateRole('user')} 
                  disabled={updating}
                  variant="outline"
                >
                  Set as User
                </Button>
                <Button 
                  onClick={() => handleUpdateRole('super_admin')} 
                  disabled={updating}
                  variant="default"
                >
                  Set as Super Admin
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
