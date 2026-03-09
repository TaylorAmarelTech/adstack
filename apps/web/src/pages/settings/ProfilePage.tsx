import { useState, useEffect, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useUpdateProfile } from '../../hooks/useAuth';
import { api } from '../../lib/api';

interface Profile {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  plan?: string;
}

export function ProfilePage() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const profileEndpoint = user?.role === 'advertiser' ? '/buyer/profile' : '/publisher/profile';

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.role],
    queryFn: () => api.get<{ data: Profile }>(profileEndpoint).then((r) => r.data),
    enabled: !!user,
  });

  const updateProfile = useUpdateProfile();

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setCompanyName(profile.companyName ?? '');
    }
  }, [profile]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccessMessage('');
    updateProfile.mutate(
      { name, companyName: companyName || undefined },
      {
        onSuccess: () => {
          setSuccessMessage('Profile updated successfully.');
        },
      },
    );
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading profile...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Profile Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account information.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="profile-company" className="block text-sm font-medium text-foreground">
              Company Name
            </label>
            <input
              id="profile-company"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company name"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              value={profile?.email ?? ''}
              readOnly
              className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed.</p>
          </div>

          {user?.role === 'publisher' && user?.plan && (
            <div>
              <label className="block text-sm font-medium text-foreground">Plan</label>
              <div className="mt-1">
                <PlanBadge plan={user.plan} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground">Role</label>
            <p className="mt-1 text-sm text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>

        {updateProfile.error && (
          <p className="mt-4 text-sm text-destructive">{updateProfile.error.message}</p>
        )}

        {successMessage && (
          <p className="mt-4 text-sm text-green-600">{successMessage}</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    pro: 'bg-blue-100 text-blue-700',
    enterprise: 'bg-purple-100 text-purple-700',
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${colors[plan] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}
