import { fetchResource } from './api';

export type MailchimpCampaignStatus = 'save' | 'paused' | 'schedule' | 'sending' | 'sent';

export interface MailchimpCampaign {
  id: string;
  web_id: number;
  type: string;
  create_time: string;
  send_time?: string;
  status: MailchimpCampaignStatus;
  emails_sent: number;
  settings: { subject_line: string; title: string; from_name: string; reply_to: string };
  report_summary?: {
    opens: number;
    unique_opens: number;
    open_rate: number;
    clicks: number;
    subscriber_clicks: number;
    click_rate: number;
  };
  recipients: { list_name?: string; recipient_count: number };
}

export interface MailchimpList {
  id: string;
  name: string;
  stats: {
    member_count: number;
    unsubscribe_count: number;
    avg_open_rate: number;
    avg_click_rate: number;
  };
  date_created: string;
}

export function fetchMailchimpCampaigns(): Promise<{ campaigns: MailchimpCampaign[]; total_items: number }> {
  return fetchResource<{ campaigns: MailchimpCampaign[]; total_items: number }>('/api/mailchimp/campaigns');
}

export function fetchMailchimpLists(): Promise<{ lists: MailchimpList[] }> {
  return fetchResource<{ lists: MailchimpList[] }>('/api/mailchimp/lists');
}
