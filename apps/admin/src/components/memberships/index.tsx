import type { Membership, MembershipInvitation } from "./memberships.types";
import { MembershipInviteDialog } from "./membership-invite-dialog";
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {total > 0 ? (
          <dl className="grid flex-1 grid-cols-2 gap-px overflow-hidden rounded-lg border border-nite-border-subtle bg-nite-border-subtle sm:grid-cols-3 xl:grid-cols-5">
            {[
              { label: "Membros", value: total },
              { label: "Acesso administrativo", value: admins },
              { label: "Acesso editorial", value: publishers },
              { label: "Inativos", value: inactive },
              { label: "Convites pendentes", value: invitations.length },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="grid min-h-16 content-center gap-1 bg-nite-surface px-4 py-3"
              >
                <dt className="text-xs font-medium text-nite-text-secondary">
                  {label}
                </dt>
                <dd className="font-mono text-base font-semibold text-nite-text-primary">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div />
        )}
        <MembershipInviteDialog />
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
