import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function Loading() {
  return (
    <main className="flex h-[calc(100vh-3rem)] items-center justify-center">
      <LoadingSpinner label="> loading leaderboard..." />
    </main>
  );
}
