import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface AdSlot {
  id: string;
  placement: string;
  format: string;
  floorCpm: number;
  frequency: string;
  isActive: boolean;
}

interface Newsletter {
  id: string;
  name: string;
  description: string | null;
  status: string;
  websiteUrl: string | null;
  primaryCategory: string | null;
  espProvider: string | null;
  metrics: {
    subscriberCount: number;
    activeSubscribers: number;
    avgOpenRate: number;
    avgClickRate: number;
  };
  adSlots: AdSlot[];
}

const CATEGORIES = [
  'technology', 'business', 'finance', 'marketing', 'lifestyle',
  'health', 'education', 'entertainment', 'science', 'politics', 'sports', 'other',
] as const;

const ESP_PROVIDERS = ['beehiiv', 'convertkit', 'mailchimp', 'substack', 'other'] as const;

export function NewsletterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    websiteUrl: '',
    primaryCategory: '',
    espProvider: '',
  });
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlot, setNewSlot] = useState({
    placement: 'top',
    format: 'banner',
    floorCpm: '',
    frequency: 'every_issue',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['newsletter', id],
    queryFn: () =>
      api.get<{ data: Newsletter }>(`/publisher/newsletters/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const updateNewsletter = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch(`/publisher/newsletters/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter', id] });
      setIsEditing(false);
    },
  });

  const addAdSlot = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post(`/publisher/newsletters/${id}/ad-slots`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter', id] });
      setShowAddSlot(false);
      setNewSlot({ placement: 'top', format: 'banner', floorCpm: '', frequency: 'every_issue' });
    },
  });

  const toggleSlot = useMutation({
    mutationFn: ({ slotId, isActive }: { slotId: string; isActive: boolean }) =>
      api.patch(`/publisher/newsletters/${id}/ad-slots/${slotId}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletter', id] });
    },
  });

  function startEditing() {
    if (!data) return;
    setEditForm({
      name: data.name,
      description: data.description ?? '',
      websiteUrl: data.websiteUrl ?? '',
      primaryCategory: data.primaryCategory ?? '',
      espProvider: data.espProvider ?? '',
    });
    setIsEditing(true);
  }

  function handleSave() {
    updateNewsletter.mutate({
      name: editForm.name,
      ...(editForm.description && { description: editForm.description }),
      ...(editForm.websiteUrl && { websiteUrl: editForm.websiteUrl }),
      ...(editForm.primaryCategory && { primaryCategory: editForm.primaryCategory }),
      ...(editForm.espProvider && { espProvider: editForm.espProvider }),
    });
  }

  function handleAddSlot() {
    addAdSlot.mutate({
      placement: newSlot.placement,
      format: newSlot.format,
      floorCpm: newSlot.floorCpm ? Number.parseFloat(newSlot.floorCpm) : 0,
      frequency: newSlot.frequency,
    });
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading newsletter...</p>;
  }

  if (!data) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">Newsletter not found.</p>
        <Link to="/newsletters" className="mt-2 text-sm text-primary hover:underline">
          Back to newsletters
        </Link>
      </div>
    );
  }

  const newsletter = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/newsletters" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to newsletters
          </Link>
          {isEditing ? (
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-2xl font-bold text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <h2 className="mt-1 text-2xl font-bold text-foreground">{newsletter.name}</h2>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateNewsletter.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {updateNewsletter.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {updateNewsletter.error && (
        <p className="text-sm text-destructive">{updateNewsletter.error.message}</p>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Subscriber Count" value={newsletter.metrics.subscriberCount.toLocaleString()} />
        <MetricCard label="Active Subscribers" value={newsletter.metrics.activeSubscribers.toLocaleString()} />
        <MetricCard
          label="Avg Open Rate"
          value={`${(newsletter.metrics.avgOpenRate * 100).toFixed(1)}%`}
        />
        <MetricCard
          label="Avg Click Rate"
          value={`${(newsletter.metrics.avgClickRate * 100).toFixed(1)}%`}
        />
      </div>

      {/* Newsletter Info */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">Newsletter Details</h3>
        <div className="mt-4 space-y-4">
          {isEditing ? (
            <>
              <div>
                <label htmlFor="edit-description" className="block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="edit-websiteUrl" className="block text-sm font-medium text-foreground">
                  Website URL
                </label>
                <input
                  id="edit-websiteUrl"
                  type="url"
                  value={editForm.websiteUrl}
                  onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-category" className="block text-sm font-medium text-foreground">
                    Category
                  </label>
                  <select
                    id="edit-category"
                    value={editForm.primaryCategory}
                    onChange={(e) => setEditForm({ ...editForm, primaryCategory: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-esp" className="block text-sm font-medium text-foreground">
                    ESP Provider
                  </label>
                  <select
                    id="edit-esp"
                    value={editForm.espProvider}
                    onChange={(e) => setEditForm({ ...editForm, espProvider: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select a provider</option>
                    {ESP_PROVIDERS.map((esp) => (
                      <option key={esp} value={esp}>
                        {esp === 'convertkit' ? 'ConvertKit' : esp.charAt(0).toUpperCase() + esp.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={newsletter.status} />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Category</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {newsletter.primaryCategory
                    ? newsletter.primaryCategory.charAt(0).toUpperCase() + newsletter.primaryCategory.slice(1)
                    : 'Not set'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">ESP Provider</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {newsletter.espProvider
                    ? newsletter.espProvider === 'convertkit'
                      ? 'ConvertKit'
                      : newsletter.espProvider.charAt(0).toUpperCase() + newsletter.espProvider.slice(1)
                    : 'Not set'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Website</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {newsletter.websiteUrl ? (
                    <a href={newsletter.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {newsletter.websiteUrl}
                    </a>
                  ) : (
                    'Not set'
                  )}
                </dd>
              </div>
              {newsletter.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">Description</dt>
                  <dd className="mt-1 text-sm text-foreground">{newsletter.description}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>

      {/* Ad Slots Section */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Ad Slots</h3>
          <button
            type="button"
            onClick={() => setShowAddSlot(!showAddSlot)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {showAddSlot ? 'Cancel' : 'Add Slot'}
          </button>
        </div>

        {/* Add Slot Form */}
        {showAddSlot && (
          <div className="mt-4 rounded-md border border-border bg-muted/50 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="slot-placement" className="block text-sm font-medium text-foreground">
                  Placement
                </label>
                <select
                  id="slot-placement"
                  value={newSlot.placement}
                  onChange={(e) => setNewSlot({ ...newSlot, placement: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                  <option value="sponsored">Sponsored Section</option>
                </select>
              </div>
              <div>
                <label htmlFor="slot-format" className="block text-sm font-medium text-foreground">
                  Format
                </label>
                <select
                  id="slot-format"
                  value={newSlot.format}
                  onChange={(e) => setNewSlot({ ...newSlot, format: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="banner">Banner</option>
                  <option value="native">Native</option>
                  <option value="sponsored_content">Sponsored Content</option>
                  <option value="text_link">Text Link</option>
                </select>
              </div>
              <div>
                <label htmlFor="slot-cpm" className="block text-sm font-medium text-foreground">
                  Floor CPM ($)
                </label>
                <input
                  id="slot-cpm"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newSlot.floorCpm}
                  onChange={(e) => setNewSlot({ ...newSlot, floorCpm: e.target.value })}
                  placeholder="5.00"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="slot-frequency" className="block text-sm font-medium text-foreground">
                  Frequency
                </label>
                <select
                  id="slot-frequency"
                  value={newSlot.frequency}
                  onChange={(e) => setNewSlot({ ...newSlot, frequency: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="every_issue">Every Issue</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            {addAdSlot.error && (
              <p className="mt-2 text-sm text-destructive">{addAdSlot.error.message}</p>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleAddSlot}
                disabled={addAdSlot.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {addAdSlot.isPending ? 'Adding...' : 'Add Ad Slot'}
              </button>
            </div>
          </div>
        )}

        {/* Slots List */}
        {newsletter.adSlots && newsletter.adSlots.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Placement</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Format</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Floor CPM</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Frequency</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {newsletter.adSlots.map((slot) => (
                  <tr key={slot.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground capitalize">{slot.placement}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {slot.format.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">${slot.floorCpm.toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {slot.frequency.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSlot.mutate({ slotId: slot.id, isActive: !slot.isActive })}
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          slot.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {slot.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !showAddSlot && (
            <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground">No ad slots configured yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first ad slot to start receiving ad placements.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    inactive: 'bg-gray-100 text-gray-600',
    suspended: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {status}
    </span>
  );
}
