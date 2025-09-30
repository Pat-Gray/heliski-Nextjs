import { Suspense } from 'react';
import ResetPasswordConfirmForm from '@/components/auth/reset-password-confirm-form';

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordConfirmForm />
    </Suspense>
  );
}
