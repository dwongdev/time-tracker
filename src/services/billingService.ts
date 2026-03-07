import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in first.');
  }
  return user.getIdToken();
}

/**
 * Create a Stripe Checkout session and redirect to it.
 */
export async function createCheckoutSession(): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Failed to start checkout');
  }

  const { url } = await response.json();
  if (url) {
    window.location.href = url;
  }
}

/**
 * Open the Stripe Customer Portal for managing subscription.
 */
export async function openCustomerPortal(): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/api/billing/portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Failed to open billing portal');
  }

  const { url } = await response.json();
  if (url) {
    window.location.href = url;
  }
}

export interface BillingStatus {
  tier: 'free' | 'premium';
  hasSubscription: boolean;
  subscriptionId?: string;
}

/**
 * Get the user's current billing status.
 */
export async function getBillingStatus(): Promise<BillingStatus> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/api/billing/status`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch billing status');
  }

  return response.json();
}
