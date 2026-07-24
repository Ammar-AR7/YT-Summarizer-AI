export interface NotionCredentials {
  apiKey: string;
  databaseId: string;
}

export interface UserConfig {
  uid: string;
  email: string | null;
  displayName: string | null;
  telegramId: string;
  notionCredentials?: NotionCredentials;
  geminiApiKey?: string;
  createdAt?: any;
}

export interface Summary {
  id: string;
  userId: string;
  userDisplayName: string;
  videoUrl: string;
  videoId: string;
  videoTitle: string;
  summaryText: string;
  isPublic: boolean;
  createdAt: any;
}

export type OutputFormat = 'notion' | 'markdown' | 'docx' | 'pdf' | 'display';
