export type Membership = {
  id: string;
  objectId: string;
  displayName: string;
  email: string | null;
  role: "admin" | "publisher";
  active: boolean;
};
