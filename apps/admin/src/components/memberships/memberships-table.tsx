import {
  EmptyState,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@nite/cms-ui";

import type { Membership } from "./memberships.types";
import { MembershipRow } from "./membership-row";

type MembershipsTableProps = {
  memberships: Membership[];
  currentMembershipId: string;
};

export function MembershipsTable({
  memberships,
  currentMembershipId,
}: MembershipsTableProps) {
  if (memberships.length === 0) {
    return (
      <EmptyState
        title="Nenhum membro cadastrado"
        description="Crie um convite institucional usando o formulário acima."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
      <Table>
        <TableHeader className="hidden md:table-header-group">
          <TableRow className="grid h-10 min-h-0 grid-cols-[minmax(180px,1fr)_150px_90px_90px] items-center gap-3 border-b border-border-subtle px-4 hover:bg-surface-subtle xl:grid-cols-[minmax(240px,1fr)_180px_100px_100px] xl:gap-4 xl:px-5">
            <TableHead className="h-auto p-0">Membro</TableHead>
            <TableHead className="h-auto p-0">Nível de acesso</TableHead>
            <TableHead className="h-auto p-0">Estado</TableHead>
            <TableHead className="h-auto p-0 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {memberships.map((membership) => (
            <MembershipRow
              key={membership.id}
              membership={membership}
              isCurrent={membership.id === currentMembershipId}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
