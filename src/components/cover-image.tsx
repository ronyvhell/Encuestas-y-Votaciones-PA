"use client"

/* eslint-disable @next/next/no-img-element */

export function CoverImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = "none"
      }}
    />
  )
}
