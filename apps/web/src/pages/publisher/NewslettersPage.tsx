import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function NewslettersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['newsletters'],
    queryFn: () => api.get<{ data: Array<{ id: string; name: string; status: string; metrics: { subscriberCount: number; avgOpenRate: number } }> }>('/publisher/newsletters'),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Newsletters</h2>
        <Link
          to="/newsletters/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Newsletter
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-6 text-muted-foreground">Loading newsletters...</p>
      ) : data?.data?.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No newsletters yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your first newsletter to start monetizing.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subscribers</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Open Rate</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.data?.map((newsletter) => (
                <tr key={newsletter.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/newsletters/${newsletter.id}`} className="text-foreground hover:text-primary">
                      {newsletter.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {newsletter.metrics.subscriberCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(newsletter.metrics.avgOpenRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      newsletter.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {newsletter.status}
                    </span>
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
