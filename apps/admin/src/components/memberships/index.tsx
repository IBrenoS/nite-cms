import type { Membership, MembershipInvitation } from "./memberships.types";
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
      <div>
        {total > 0 ? (
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle sm:grid-cols-3 xl:grid-cols-5">
            {[
              { label: "Membros", value: total },
              { label: "Acesso administrativo", value: admins },
              { label: "Acesso editorial", value: publishers },
              { label: "Inativos", value: inactive },
              { label: "Convites pendentes", value: invitations.length },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="grid min-h-16 content-center gap-1 bg-surface px-4 py-3"
              >
                <dt className="text-ui-sm font-medium text-text-secondary">
                  {label}
                </dt>
                <dd className="font-mono text-ui-lg font-semibold text-text-primary">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <MembershipInvitations invitations={invitations} />

      {/* Members table */}
      <MembershipsTable
        memberships={memberships}
        currentMembershipId={currentMembershipId}
      />
    </div>
  );
}
