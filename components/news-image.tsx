"use client";

import { useState } from "react";

type NewsImageProps = {
  src: string | null | undefined;
  alt: string;
  variant: "card" | "detail";
};

function isSafeRemoteImage(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function NewsImage({ src, alt, variant }: NewsImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed || !isSafeRemoteImage(src)) return null;

  return (
    <div className={`news-image news-image-${variant}`}>
      {/* Dynamic source hosts come from the existing news allowlist; hide the image if the remote URL fails. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
