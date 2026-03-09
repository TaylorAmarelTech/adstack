import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

const PRICING_MODELS = [
  { value: 'cpm', label: 'CPM (Cost Per Mille)' },
  { value: 'cpc', label: 'CPC (Cost Per Click)' },
  { value: 'hybrid', label: 'Hybrid (CPM + CPC)' },
] as const;

const CATEGORY_OPTIONS = [
  'technology', 'business', 'finance', 'marketing', 'lifestyle',
  'health', 'education', 'entertainment', 'science', 'politics', 'sports', 'other',
] as const;

export function CreateCampaignPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [dailyBudgetCap, setDailyBudgetCap] = useState('');
  const [pricingModel, setPricingModel] = useState('cpm');
  const [maxCPM, setMaxCPM] = useState('');
  const [maxCPC, setMaxCPC] = useState('');
  const [audienceDescription, setAudienceDescription] = useState('');
  const [categories, setCategories] = useState('');
  const [minEngagementScore, setMinEngagementScore] = useState('50');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const createCampaign = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/buyer/campaigns', data),
    onSuccess: () => {
      navigate('/campaigns');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const categoriesArray = categories
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    createCampaign.mutate({
      name,
      totalBudget: Number.parseFloat(totalBudget),
      ...(dailyBudgetCap && { dailyBudgetCap: Number.parseFloat(dailyBudgetCap) }),
      pricingModel,
      ...(maxCPM && { maxCpm: Number.parseFloat(maxCPM) }),
      ...(maxCPC && { maxCpc: Number.parseFloat(maxCPC) }),
      targeting: {
        ...(audienceDescription && { audienceDescription }),
        ...(categoriesArray.length > 0 && { categories: categoriesArray }),
        ...(minEngagementScore && { minEngagementScore: Number.parseInt(minEngagementScore, 10) }),
      },
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Create Campaign</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up a new ad campaign to reach newsletter audiences.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">Campaign Details</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="campaign-name" className="block text-sm font-medium text-foreground">
                Campaign Name <span className="text-destructive">*</span>
              </label>
              <input
                id="campaign-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Q1 Product Launch"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="total-budget" className="block text-sm font-medium text-foreground">
                  Total Budget ($) <span className="text-destructive">*</span>
                </label>
                <input
                  id="total-budget"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  required
                  placeholder="1000.00"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="daily-cap" className="block text-sm font-medium text-foreground">
                  Daily Budget Cap ($)
                </label>
                <input
                  id="daily-cap"
                  type="number"
                  step="0.01"
                  min="0"
                  value={dailyBudgetCap}
                  onChange={(e) => setDailyBudgetCap(e.target.value)}
                  placeholder="100.00"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label htmlFor="pricing-model" className="block text-sm font-medium text-foreground">
                Pricing Model <span className="text-destructive">*</span>
              </label>
              <select
                id="pricing-model"
                value={pricingModel}
                onChange={(e) => setPricingModel(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {PRICING_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(pricingModel === 'cpm' || pricingModel === 'hybrid') && (
                <div>
                  <label htmlFor="max-cpm" className="block text-sm font-medium text-foreground">
                    Max CPM ($)
                  </label>
                  <input
                    id="max-cpm"
                    type="number"
                    step="0.01"
                    min="0"
                    value={maxCPM}
                    onChange={(e) => setMaxCPM(e.target.value)}
                    placeholder="10.00"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}
              {(pricingModel === 'cpc' || pricingModel === 'hybrid') && (
                <div>
                  <label htmlFor="max-cpc" className="block text-sm font-medium text-foreground">
                    Max CPC ($)
                  </label>
                  <input
                    id="max-cpc"
                    type="number"
                    step="0.01"
                    min="0"
                    value={maxCPC}
                    onChange={(e) => setMaxCPC(e.target.value)}
                    placeholder="1.50"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Targeting */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">Targeting</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="audience-desc" className="block text-sm font-medium text-foreground">
                Audience Description
              </label>
              <textarea
                id="audience-desc"
                value={audienceDescription}
                onChange={(e) => setAudienceDescription(e.target.value)}
                rows={3}
                placeholder="Describe your ideal audience (e.g. startup founders, B2B SaaS buyers, tech-savvy professionals)"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Our AI will use this to match your ads with the most relevant newsletter subscribers.
              </p>
            </div>

            <div>
              <label htmlFor="categories" className="block text-sm font-medium text-foreground">
                Categories
              </label>
              <input
                id="categories"
                type="text"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="technology, business, finance"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Comma-separated list. Options: {CATEGORY_OPTIONS.join(', ')}
              </p>
            </div>

            <div>
              <label htmlFor="engagement-score" className="block text-sm font-medium text-foreground">
                Min Engagement Score: {minEngagementScore}
              </label>
              <input
                id="engagement-score"
                type="range"
                min="0"
                max="100"
                value={minEngagementScore}
                onChange={(e) => setMinEngagementScore(e.target.value)}
                className="mt-2 w-full accent-primary"
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>0 (any)</span>
                <span>100 (highest)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">Schedule</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-foreground">
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-foreground">
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {createCampaign.error && (
          <p className="text-sm text-destructive">{createCampaign.error.message}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            to="/campaigns"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createCampaign.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}
