import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalBudget: number;
  spent: number;
  startDate: string | null;
  endDate: string | null;
}

type StatusFilter = 'all' | 'draft' | 'active' | 'paused' | 'completed';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

export function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () =>
      api.get<{ data: Campaign[] }>('/buyer/campaigns').then((r) => r.data),
  });

  const campaigns = data ?? [];
  const filtered =
    statusFilter === 'all'
      ? campaigns
      : campaigns.filter((c) => c.status === statusFilter);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString();
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Campaigns</h2>
        <Link
          to="/campaigns/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create Campaign
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="mt-4 flex gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-6 text-muted-foreground">Loading campaigns...</p>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            {statusFilter === 'all'
              ? 'No campaigns yet.'
              : `No ${statusFilter} campaigns.`}
          </p>
          {statusFilter === 'all' && (
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first campaign to start reaching newsletter audiences.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Budget</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Spent</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Start Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">End Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{campaign.name}</td>
                  <td className="px-4 py-3">
                    <CampaignStatusBadge status={campaign.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatCurrency(campaign.totalBudget)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatCurrency(campaign.spent)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(campaign.startDate)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(campaign.endDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
