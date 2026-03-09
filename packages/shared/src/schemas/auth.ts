import { z } from 'zod';

const loginRequest = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registerRequest = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  companyName: z.string().max(200).optional(),
  role: z.enum(['publisher', 'advertiser']),
});

const sessionUser = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['publisher', 'advertiser', 'admin']),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
});

export const authSchemas = {
  loginRequest,
  registerRequest,
  sessionUser,
};

export type LoginRequest = z.infer<typeof loginRequest>;
export type RegisterRequest = z.infer<typeof registerRequest>;
export type SessionUser = z.infer<typeof sessionUser>;
