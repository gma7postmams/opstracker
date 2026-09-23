export interface U {
  id: number;
  name: string;
  firstName: string;
  middleInitial: string | null;
  surname: string;
  email: string;
  username: string;
  role: "ADMIN" | "USER";
  avatarUrl: string | null;
  lastLogin: string | null;
  recordCount: number;
  smtpEmail?: string | null;
  smtpPassword?: string | null;
  smtpRecipients?: string | null;
  smtpEnabled?: boolean;
}