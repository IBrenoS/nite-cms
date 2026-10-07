"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  IconButton,
  PlusIcon,
  XIcon,
} from "@nite/cms-ui";

import { MembershipCreateForm } from "./membership-create-form";

export function MembershipInviteDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="lg"
        className="self-stretch sm:self-start"
        onClick={() => setOpen(true)}
      >
        <PlusIcon aria-hidden="true" />
        Convidar pessoa
      </Button>

      <DialogContent
        aria-label="Convidar pessoa para o CMS"
        className="max-w-2xl gap-5 p-5 sm:p-6"
      >
        <DialogHeader className="relative pr-12">
          <DialogTitle>Convidar pessoa</DialogTitle>
          <DialogDescription>
            Autorize uma conta institucional para o primeiro acesso ao CMS.
          </DialogDescription>
          <IconButton
            type="button"
            aria-label="Fechar convite"
            variant="ghost"
            className="absolute -top-1 right-0 size-10"
            onClick={() => setOpen(false)}
          >
            <XIcon aria-hidden="true" />
          </IconButton>
        </DialogHeader>
        <MembershipCreateForm embedded />
      </DialogContent>
    </Dialog>
  );
}
