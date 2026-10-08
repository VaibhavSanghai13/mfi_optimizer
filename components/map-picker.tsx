'use client'

import dynamic from 'next/dynamic'

const PickerInner = dynamic(() => import('./maps/picker-inner'), {
  ssr: false,
  loading: () => <div className="flex h-56 w-full items-center justify-center text-xs text-muted-foreground">Loading map…</div>,
})

/** Click the map to place the pin, drag it to move it; typing coordinates moves the pin too. */
export function MapPicker({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
  return <div className="overflow-hidden rounded-lg border bg-muted">
    <PickerInner lat={lat} lng={lng} onChange={onChange} />
    <p className="border-t bg-card px-3 py-1.5 text-[11px] text-muted-foreground">Click the map to place the pin, or drag it to adjust.</p>
  </div>
}
