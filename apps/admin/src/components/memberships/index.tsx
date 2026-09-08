import type { Membership, MembershipInvitation } from "./memberships.types";
import { MembershipCreateForm } from "./membership-create-form";
import { MembershipInvitations } from "./membership-invitations";
import { MembershipsTable } from "./memberships-table";

type MembershipsPanelProps = {
  memberships: Membership[];
  invitations: MembershipInvitation[];
  currentMembershipId: string;
};

export function MembershipsPanel({
  memberships,
  invitations,
  currentMembershipId,
}: MembershipsPanelProps) {
  const total = memberships.length;
  const admins = memberships.filter((m) => m.role === "admin").length;
  const publishers = memberships.filter((m) => m.role === "publisher").length;
  const inactive = memberships.filter((m) => !m.active).length;

  return (
    <div className="grid gap-5">
      {/* Metrics strip */}
      {total > 0 ? (
        <dl className="flex flex-wrap gap-4">
          {[
            { label: "Membros", value: total },
            { label: "Acesso administrativo", value: admins },
            { label: "Acesso editorial", value: publishers },
            { label: "Inativos", value: inactive },
            { label: "Convites pendentes", value: invitations.length },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-md border border-nite-border-subtle bg-nite-surface px-3 py-1.5"
            >
              <dt className="text-xs text-nite-text-secondary">{label}</dt>
              <dd className="font-mono text-sm font-semibold text-nite-text-primary">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* Create form */}
      <MembershipCreateForm />
      <MembershipInvitations invitations={invitations} />

      {/* Members table */}
      <MembershipsTable
        memberships={memberships}
        currentMembershipId={currentMembershipId}
      />
    </div>
  );
}
