import ProtectedRoute from '@/components/auth/protected-route';
import UserManagement from '@/components/auth/user-management';

export default function UsersPage() {
  return (
    <ProtectedRoute requireSuperAdmin={true}>
      <div className="container mx-auto p-6">
        <UserManagement />
      </div>
    </ProtectedRoute>
  );
}
