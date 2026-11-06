import { memo, useMemo } from 'react';
import { encode } from 'uqr';
import { cn } from '@/lib/cn';

/**
 * QR code drawn as one SVG path (crisp at any projector size). Encoded locally
 * with `uqr`; nothing is sent to a QR web service.
 */
export const QrCode = memo(function QrCode({ value, className, label }: { value: string; className?: string; label: string }) {
  const { path, size } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 2 });
    let d = '';
    qr.data.forEach((row, y) => {
      row.forEach((on, x) => {
        if (on) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { path: d, size: qr.size };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={cn('block aspect-square bg-white', className)}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <path d={path} fill="#17161c" />
    </svg>
  );
});
