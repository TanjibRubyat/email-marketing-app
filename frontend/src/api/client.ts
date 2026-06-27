import type { Contact, ContactList, Campaign, SendRecord, CampaignStats } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

/**
 * There's no login/session system yet (the backend has a `users` table but
 * no auth endpoints) - this app is single-user for now, hardcoded to the
 * test user created during backend development. Swapping this for a real
 * logged-in user ID is the main thing a future auth pass needs to change.
 */
export const CURRENT_USER_ID = 1;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Contacts ---

export function getContacts(): Promise<Contact[]> {
  return request(`/api/contacts?user_id=${CURRENT_USER_ID}`);
}

export function createContact(data: {
  email: string;
  first_name?: string;
  last_name?: string;
}): Promise<Contact> {
  return request('/api/contacts', {
    method: 'POST',
    body: JSON.stringify({ ...data, user_id: CURRENT_USER_ID }),
  });
}

export function deleteContact(id: number): Promise<void> {
  return request(`/api/contacts/${id}`, { method: 'DELETE' });
}

// --- Lists ---

export function getLists(): Promise<ContactList[]> {
  return request(`/api/lists?user_id=${CURRENT_USER_ID}`);
}

export function createList(data: { name: string; description?: string }): Promise<ContactList> {
  return request('/api/lists', {
    method: 'POST',
    body: JSON.stringify({ ...data, user_id: CURRENT_USER_ID }),
  });
}

export function getListContacts(listId: number): Promise<Contact[]> {
  return request(`/api/lists/${listId}/contacts`);
}

export function addContactToList(listId: number, contactId: number): Promise<void> {
  return request(`/api/lists/${listId}/contacts`, {
    method: 'POST',
    body: JSON.stringify({ contact_id: contactId }),
  });
}

export function removeContactFromList(listId: number, contactId: number): Promise<void> {
  return request(`/api/lists/${listId}/contacts/${contactId}`, { method: 'DELETE' });
}

// --- Campaigns ---

export function getCampaigns(): Promise<Campaign[]> {
  return request(`/api/campaigns?user_id=${CURRENT_USER_ID}`);
}

export function getCampaign(id: number): Promise<Campaign> {
  return request(`/api/campaigns/${id}`);
}

export function createCampaign(data: {
  name: string;
  subject: string;
  from_name: string;
  from_email: string;
  html_body?: string;
  text_body?: string;
  list_ids?: number[];
}): Promise<Campaign> {
  return request('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({ ...data, user_id: CURRENT_USER_ID }),
  });
}

export function sendCampaign(id: number): Promise<{ queued: number }> {
  return request(`/api/campaigns/${id}/send`, { method: 'POST' });
}

export function getCampaignSends(id: number): Promise<SendRecord[]> {
  return request(`/api/campaigns/${id}/sends`);
}

export function getCampaignStats(id: number): Promise<CampaignStats> {
  return request(`/api/campaigns/${id}/stats`);
}
