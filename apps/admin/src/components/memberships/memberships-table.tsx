import { EmptyState } from "@nite/cms-ui";

import type { Membership } from "./memberships.types";
import { MembershipRow } from "./membership-row";

type MembershipsTableProps = {
  memberships: Membership[];
};

export function MembershipsTable({ memberships }: MembershipsTableProps) {
  if (memberships.length === 0) {
    return (
      <EmptyState
        title="Nenhum membro cadastrado"
        description="Adicione o primeiro membro da equipe usando o formulário acima."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-nite-border-subtle bg-nite-surface">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_130px_90px_90px] items-center gap-3 border-b border-nite-border-subtle bg-nite-section/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-nite-text-secondary">
        <span>Membro</span>
        <span>Papel</span>
        <span>Estado</span>
        <span className="text-right">Ações</span>
      </div>
      <table className="w-full">
        <thead className="sr-only">
          <tr>
            <th scope="col">Membro</th>
            <th scope="col">Papel</th>
            <th scope="col">Estado</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((membership, index) => (
            <MembershipRow
              key={membership.id}
              membership={membership}
              isLast={index === memberships.length - 1}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
