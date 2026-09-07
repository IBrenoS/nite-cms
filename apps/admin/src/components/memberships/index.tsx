import type { Membership } from "./memberships.types";
import { MembershipCreateForm } from "./membership-create-form";
import { MembershipsTable } from "./memberships-table";

type MembershipsPanelProps = {
  memberships: Membership[];
};

export function MembershipsPanel({ memberships }: MembershipsPanelProps) {
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
            { label: "Admins", value: admins },
            { label: "Publishers", value: publishers },
            { label: "Inativos", value: inactive },
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

      {/* Members table */}
      <MembershipsTable memberships={memberships} />
    </div>
  );
}
