'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

const pin = L.divIcon({
  className: '', iconSize: [22, 30], iconAnchor: [11, 30],
  html: `<svg width="22" height="30" viewBox="0 0 22 30"><path d="M11 0C4.9 0 0 4.9 0 11c0 8.2 11 19 11 19s11-10.8 11-19C22 4.9 17.1 0 11 0z" fill="#171717"/><circle cx="11" cy="11" r="4.5" fill="#fff"/></svg>`,
})

function Follow({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { if (Number.isFinite(lat) && Number.isFinite(lng)) map.panTo([lat, lng]) }, [lat, lng, map])
  return null
}

function ClickToPlace({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onChange(round(e.latlng.lat), round(e.latlng.lng)) })
  return null
}

const round = (v: number) => Math.round(v * 10000) / 10000

export default function PickerInner({ lat, lng, onChange, className = 'h-56 w-full' }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void; className?: string }) {
  const valid = Number.isFinite(lat) && Number.isFinite(lng)
  const position: [number, number] = valid ? [lat, lng] : [18.151, 74.577]
  return <MapContainer center={position} zoom={12} scrollWheelZoom className={className}>
    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Marker position={position} icon={pin} draggable eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange(round(p.lat), round(p.lng)) } }} />
    <ClickToPlace onChange={onChange} />
    <Follow lat={lat} lng={lng} />
  </MapContainer>
}
