import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'publisher' | 'advertiser' | 'admin';
  plan?: string;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<{ data: User }>('/auth/me').then((r) => r.data),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return { user, isLoading, isAuthenticated: !!user };
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api.post('/auth/login', credentials),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post('/auth/logout', {}),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const endpoint = user?.role === 'advertiser' ? '/buyer/profile' : '/publisher/profile';

  return useMutation({
    mutationFn: (data: { name?: string; companyName?: string }) =>
      api.patch(endpoint, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}
