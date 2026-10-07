"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  src: string;
  width: number;
  height: number;
  playbackMode: "autoplay" | "manual";
  description?: string;
  captions?: {
    src: string;
    srclang: "pt-BR";
    label: "Português";
  };
};

export function EditorialVideo(props: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const descriptionId = useId();
  const statusId = useId();
  const autoplay = props.playbackMode === "autoplay";
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    if (!autoplay) return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setAutoplayEnabled(false);
      setStatus(
        "A reprodução automática foi desativada pela preferência de movimento do seu dispositivo.",
      );
      return;
    }
    const video = ref.current;
    if (!video) return;
    let active = true;
    video.defaultMuted = true;
    setAutoplayEnabled(true);
    setStatus(undefined);
    try {
      void video.play().catch(() => {
        if (active)
          setStatus(
            "A reprodução automática foi bloqueada pelo seu navegador.",
          );
      });
    } catch {
      setStatus("A reprodução automática foi bloqueada pelo seu navegador.");
    }
    return () => {
      active = false;
    };
  }, [autoplay]);

  const describedBy = [
    props.description ? descriptionId : undefined,
    status ? statusId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <video
        ref={ref}
        crossOrigin="anonymous"
        width={props.width}
        height={props.height}
        autoPlay={autoplay && autoplayEnabled}
        muted={autoplay}
        playsInline={autoplay}
        loop={autoplay}
        controls={!autoplay}
        preload={autoplay ? "auto" : "metadata"}
        aria-describedby={describedBy || undefined}
        className="h-auto w-full rounded-lg border border-nite-border-subtle"
        onError={() => setStatus("Não foi possível carregar o vídeo.")}
      >
        <source src={props.src} type="video/mp4" />
        {props.captions ? (
          <track
            kind="captions"
            src={props.captions.src}
            srcLang={props.captions.srclang}
            label={props.captions.label}
            default={!autoplay}
          />
        ) : null}
      </video>
      {props.description ? (
        <span id={descriptionId} className="sr-only">
          {props.description}
        </span>
      ) : null}
      {status ? (
        <p id={statusId} role="status" className="text-ui-xs text-text-muted">
          {status}
        </p>
      ) : null}
    </>
  );
}
