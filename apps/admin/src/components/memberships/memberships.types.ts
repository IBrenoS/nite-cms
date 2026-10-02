export type Membership = {
  id: string;
  objectId: string;
  displayName: string;
  email: string | null;
  role: "admin" | "publisher";
  active: boolean;
};

export type MembershipInvitation = {
  id: string;
  email: string;
  role: "admin" | "publisher";
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  expired: boolean;
  deliveryStatus?:
    | "pending"
    | "sent"
    | "delivered"
    | "bounced"
    | "complained"
    | "failed"
    | null;
};
