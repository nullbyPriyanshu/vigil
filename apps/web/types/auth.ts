export type Role = "OWNER" | "ADMIN" | "RESPONDER" | "VIEWER";

export type Session = {
  user: {
    id: string;
    name: string;
    email: string;
    timezone: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  role: Role;
};