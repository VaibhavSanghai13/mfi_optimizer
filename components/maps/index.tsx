'use client'

import dynamic from 'next/dynamic'
import type { MapProps } from './leaflet-map'

export type { MapPoint, MapRoute, MapProps } from './leaflet-map'

/** Leaflet touches `window`, so the map only renders in the browser. */
export const RouteMap = dynamic<MapProps>(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-40 w-full items-center justify-center bg-muted text-xs text-muted-foreground">Loading map…</div>,
})
