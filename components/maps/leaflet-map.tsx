'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'

export type MapPoint = { id: string; lat: number; lng: number; color: string; label?: string; hollow?: boolean; popup?: React.ReactNode }
export type MapRoute = { id: string; color: string; positions: [number, number][] }
export type MapProps = {
  branch?: { lat: number; lng: number; name: string }
  points?: MapPoint[]
  routes?: MapRoute[]
  /** Change this value to re-fit the map to its contents. */
  fitKey?: string
  className?: string
}

const pointIcon = (p: MapPoint) => L.divIcon({
  className: '',
  iconSize: p.label ? [24, 24] : [14, 14],
  iconAnchor: p.label ? [12, 12] : [7, 7],
  popupAnchor: [0, -10],
  html: p.hollow
    ? `<div style="width:14px;height:14px;border-radius:9999px;border:2.5px solid #94a3b8;background:rgba(255,255,255,.9)"></div>`
    : p.label
      ? `<div style="width:24px;height:24px;border-radius:9999px;background:${p.color};color:#fff;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:600 11px system-ui">${p.label}</div>`
      : `<div style="width:14px;height:14px;border-radius:9999px;background:${p.color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
})

const branchIcon = L.divIcon({
  className: '', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14],
  html: `<div style="width:30px;height:30px;border-radius:8px;background:#171717;color:#fff;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font:700 9px system-ui">HQ</div>`,
})

function FitBounds({ coords, fitKey }: { coords: [number, number][]; fitKey?: string }) {
  const map = useMap()
  useEffect(() => {
    if (!coords.length) return
    map.fitBounds(L.latLngBounds(coords), { padding: [32, 32], maxZoom: 13 })
  }, [fitKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function LeafletMap({ branch, points = [], routes = [], fitKey, className = 'h-72 w-full' }: MapProps) {
  const coords = useMemo(() => [
    ...(branch ? [[branch.lat, branch.lng] as [number, number]] : []),
    ...points.map((p) => [p.lat, p.lng] as [number, number]),
    ...routes.flatMap((r) => r.positions),
  ], [branch, points, routes])
  const center: [number, number] = branch ? [branch.lat, branch.lng] : coords[0] ?? [18.151, 74.577]
  return <MapContainer center={center} zoom={11} scrollWheelZoom className={className}>
    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {routes.map((r) => <Polyline key={r.id} positions={r.positions} pathOptions={{ color: r.color, weight: 4, opacity: 0.85 }} />)}
    {points.map((p) => <Marker key={p.id} position={[p.lat, p.lng]} icon={pointIcon(p)}>{p.popup && <Popup>{p.popup}</Popup>}</Marker>)}
    {branch && <Marker position={[branch.lat, branch.lng]} icon={branchIcon} zIndexOffset={1000}><Popup><strong>{branch.name}</strong><br />Start and end of every route</Popup></Marker>}
    <FitBounds coords={coords} fitKey={fitKey} />
  </MapContainer>
}
