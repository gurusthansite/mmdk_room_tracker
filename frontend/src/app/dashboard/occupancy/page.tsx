'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OccupancyRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/reception');
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-500 text-sm">
      Redirecting to Reception Desk (Check-in &amp; Check-out)...
    </div>
  );
}
