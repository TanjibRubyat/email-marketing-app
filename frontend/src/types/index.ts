export interface Contact {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: 'subscribed' | 'unsubscribed' | 'bounced' | 'complained';
  custom_fields: Record<string, unknown>;
  created_at: string;
}

export interface ContactList {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  contact_count: number;
}

export interface Campaign {
  id: number;
  name: string;
  subject: string;
  from_name: string;
  from_email: string;
  html_body: string | null;
  text_body: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface SendRecord {
  id: number;
  status: 'pending' | 'sent' | 'bounced' | 'failed';
  smtp_response: string | null;
  sent_at: string | null;
  email: string;
}

export interface CampaignStats {
  sent: string;
  bounced: string;
  failed: string;
  pending: string;
  unique_opens: string;
  total_opens: string;
  unique_clicks: string;
  total_clicks: string;
}
