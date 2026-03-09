import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';

interface PublisherStats {
  newsletterCount: number;
  totalSubscribers: number;
  avgOpenRate: number;
  revenue: number;
}

interface AdvertiserStats {
  activeCampaigns: number;
  totalSpend: number;
  impressions: number;
  clicks: number;
}

export function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'advertiser') {
    return <AdvertiserDashboard name={user.name} />;
  }

  return <PublisherDashboard name={user?.name ?? ''} />;
}

function PublisherDashboard({ name }: { name: string }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['publisher', 'stats'],
    queryFn: () =>
      api.get<{ data: PublisherStats }>('/publisher/stats').then((r) => r.data),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
      <p className="mt-2 text-muted-foreground">
        Welcome back, {name}. Here's your publisher overview.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Newsletters"
          value={isLoading ? '--' : String(stats?.newsletterCount ?? 0)}
        />
        <StatCard
          label="Total Subscribers"
          value={isLoading ? '--' : (stats?.totalSubscribers ?? 0).toLocaleString()}
        />
        <StatCard
          label="Avg Open Rate"
          value={isLoading ? '--' : `${((stats?.avgOpenRate ?? 0) * 100).toFixed(1)}%`}
        />
        <StatCard
          label="Revenue (30d)"
          value={
            isLoading
              ? '--'
              : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                  stats?.revenue ?? 0,
                )
          }
        />
      </div>
    </div>
  );
}

function AdvertiserDashboard({ name }: { name: string }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['buyer', 'stats'],
    queryFn: () =>
      api.get<{ data: AdvertiserStats }>('/buyer/stats').then((r) => r.data),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
      <p className="mt-2 text-muted-foreground">
        Welcome back, {name}. Here's your advertiser overview.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Campaigns"
          value={isLoading ? '--' : String(stats?.activeCampaigns ?? 0)}
        />
        <StatCard
          label="Total Spend"
          value={
            isLoading
              ? '--'
              : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                  stats?.totalSpend ?? 0,
                )
          }
        />
        <StatCard
          label="Impressions"
          value={isLoading ? '--' : (stats?.impressions ?? 0).toLocaleString()}
        />
        <StatCard
          label="Clicks"
          value={isLoading ? '--' : (stats?.clicks ?? 0).toLocaleString()}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
