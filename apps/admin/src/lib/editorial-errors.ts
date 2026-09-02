import { z } from "zod";

import {
  CmsAuthorizationError,
  EditorialConflictError,
  EditorialPublicationError,
  EditorialSlugConflictError,
  MediaProcessingError,
  MediaQuarantinedError,
} from "@nite/editorial";

import {
  EditorialBodyParseError,
  type EditorialFieldErrors,
  zodFieldErrors,
} from "./editorial-form";

export type EditorialOperation =
  "save" | "publish" | "lifecycle" | "media" | "preview";

type EditorialOperationErrorCode =
  | "publication_prerequisite"
  | "media_file"
  | "media_transfer"
  | "media_processing"
  | "media_quarantined"
  | "preview_unavailable"
  | "not_found";

export type EditorialActionFailure =
  | {
      status: "validation_error";
      message: string;
      fieldErrors: EditorialFieldErrors;
    }
  | { status: "conflict"; message: string }
  | { status: "forbidden"; message: string }
  | {
      status: "operation_error";
      code: EditorialOperationErrorCode;
      message: string;
      retryable: boolean;
    }
  | { status: "unexpected_error"; message: string; errorId: string };

export type EditorialActionResult<T> =
  { status: "success"; data: T; message?: string } | EditorialActionFailure;

export function editorialActionFailure(
  error: unknown,
  operation: EditorialOperation,
): EditorialActionFailure {
  if (
    error instanceof z.ZodError ||
    error instanceof SyntaxError ||
    error instanceof EditorialBodyParseError
  ) {
    return {
      status: "validation_error",
      message: "Revise os campos destacados.",
      fieldErrors: zodFieldErrors(error),
    };
  }
  if (error instanceof EditorialSlugConflictError) {
    return {
      status: "validation_error",
      message: "Revise os campos destacados.",
      fieldErrors: { slug: [error.message] },
    };
  }
  if (error instanceof EditorialConflictError) {
    return { status: "conflict", message: error.message };
  }
  if (error instanceof CmsAuthorizationError) {
    return {
      status: "forbidden",
      message: "Sua sessão não possui permissão para concluir esta operação.",
    };
  }
  if (error instanceof MediaQuarantinedError) {
    return {
      status: "operation_error",
      code: "media_quarantined",
      message: error.message,
      retryable: false,
    };
  }
  if (error instanceof MediaProcessingError) {
    return {
      status: "operation_error",
      code: "media_processing",
      message: error.message,
      retryable: true,
    };
  }
  if (error instanceof EditorialPublicationError) {
    return {
      status: "operation_error",
      code: "publication_prerequisite",
      message: error.message,
      retryable: false,
    };
  }

  const errorId = crypto.randomUUID();
  console.error("editorial_action_failed", {
    errorId,
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return {
    status: "unexpected_error",
    message: "Não foi possível concluir a operação editorial.",
    errorId,
  };
}
