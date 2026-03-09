import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

const CATEGORIES = [
  'technology',
  'business',
  'finance',
  'marketing',
  'lifestyle',
  'health',
  'education',
  'entertainment',
  'science',
  'politics',
  'sports',
  'other',
] as const;

const ESP_PROVIDERS = [
  'beehiiv',
  'convertkit',
  'mailchimp',
  'substack',
  'other',
] as const;

export function CreateNewsletterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [primaryCategory, setPrimaryCategory] = useState('');
  const [espProvider, setEspProvider] = useState('');

  const createNewsletter = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      websiteUrl?: string;
      primaryCategory?: string;
      espProvider?: string;
    }) => api.post('/publisher/newsletters', data),
    onSuccess: () => {
      navigate('/newsletters');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createNewsletter.mutate({
      name,
      ...(description && { description }),
      ...(websiteUrl && { websiteUrl }),
      ...(primaryCategory && { primaryCategory }),
      ...(espProvider && { espProvider }),
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Add Newsletter</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a new newsletter to start monetizing with targeted ads.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              Newsletter Name <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. The Morning Brew"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Briefly describe your newsletter's content and audience"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="websiteUrl" className="block text-sm font-medium text-foreground">
              Website URL
            </label>
            <input
              id="websiteUrl"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://yournewsletter.com"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="primaryCategory" className="block text-sm font-medium text-foreground">
              Primary Category
            </label>
            <select
              id="primaryCategory"
              value={primaryCategory}
              onChange={(e) => setPrimaryCategory(e.target.value)}
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
            <label htmlFor="espProvider" className="block text-sm font-medium text-foreground">
              ESP Provider
            </label>
            <select
              id="espProvider"
              value={espProvider}
              onChange={(e) => setEspProvider(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select your email provider</option>
              {ESP_PROVIDERS.map((esp) => (
                <option key={esp} value={esp}>
                  {esp === 'convertkit' ? 'ConvertKit' : esp.charAt(0).toUpperCase() + esp.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {createNewsletter.error && (
          <p className="mt-4 text-sm text-destructive">{createNewsletter.error.message}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Link
            to="/newsletters"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createNewsletter.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createNewsletter.isPending ? 'Creating...' : 'Create Newsletter'}
          </button>
        </div>
      </form>
    </div>
  );
}
