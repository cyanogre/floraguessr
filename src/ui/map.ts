import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';
import land50Url from 'world-atlas/land-50m.json?url';
import { RADIUS_KM } from '../config';
import type { Place } from '../game/types';
import { PIN_SVG } from './icons';

const ESRI_ATTR = 'Imágenes: Esri, Vantor, Earthstar Geographics y la comunidad de usuarios GIS';

/**
 * Con clave de ArcGIS Location Platform usamos el servicio de teselas estáticas, que es el que cubren
 * sus condiciones de uso. Sin clave, el endpoint histórico (solo para desarrollo).
 */
function satelliteUrl(): string {
  const key = import.meta.env.VITE_ESRI_KEY as string | undefined;
  return key
    ? `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/static/tile/{z}/{y}/{x}?token=${encodeURIComponent(key)}`
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
}

export class FieldMap {
  readonly map: L.Map;
  private layer = L.layerGroup();
  private sat: L.TileLayer | null = null;
  private satOn = false;
  private settle: ReturnType<typeof setTimeout> | null = null;

  constructor(el: HTMLElement, opts: { satellite: boolean }) {
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim();
    const land = css.getPropertyValue('--land').trim();
    this.map = L.map(el, {
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 13,
      zoomControl: false,
      preferCanvas: true,
      attributionControl: true,
    }).setView([25, 5], 2);
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(this.map);
    // Sobre el mapa solo va lo que exige el proveedor del satélite; el resto se cita en la ficha y en
    // «Fuentes y créditos» (Leaflet no pide crédito visible; Natural Earth es de dominio público).
    this.map.attributionControl.setPrefix(false);
    this.map.attributionControl.setPosition('bottomleft');

    // Tierra y retícula en un panel propio, por debajo de las teselas de satélite (200) y de la ronda.
    this.map.createPane('paper').style.zIndex = '150';
    const renderer = L.canvas({ pane: 'paper' });
    const style = { color: ink, weight: 0.8, opacity: 0.85, fillColor: land, fillOpacity: 1 };
    const topo = land110 as unknown as Topology;
    const coarse = L.geoJSON(feature(topo, topo.objects.land), { interactive: false, style, pane: 'paper', renderer, noClip: true } as L.GeoJSONOptions).addTo(this.map);
    // Costa más detallada (1:50 millones) en segundo plano: a la escala del círculo se nota.
    fetch(land50Url)
      .then((r) => (r.ok ? (r.json() as Promise<Topology>) : Promise.reject(new Error(String(r.status)))))
      .then((t50) => {
        L.geoJSON(feature(t50, t50.objects.land), { interactive: false, style, pane: 'paper', renderer, noClip: true } as L.GeoJSONOptions).addTo(this.map);
        coarse.remove();
      })
      .catch(() => undefined);
    for (let lat = -60; lat <= 60; lat += 30) {
      L.polyline([[lat, -180], [lat, 180]], { color: ink, weight: 0.4, opacity: 0.35, dashArray: '2 5', interactive: false, pane: 'paper', renderer }).addTo(this.map);
    }
    for (let lng = -180; lng <= 180; lng += 30) {
      L.polyline([[-85, lng], [85, lng]], { color: ink, weight: 0.4, opacity: 0.35, dashArray: '2 5', interactive: false, pane: 'paper', renderer }).addTo(this.map);
    }

    if (opts.satellite) {
      this.sat = L.tileLayer(satelliteUrl(), { maxZoom: 17, attribution: ESRI_ATTR });
      this.setSatellite(true);
    }
    this.layer.addTo(this.map);
  }

  get hasSatellite(): boolean {
    return this.sat != null;
  }

  setSatellite(on: boolean): void {
    if (!this.sat) return;
    this.satOn = on;
    if (on) this.sat.addTo(this.map);
    else this.sat.remove();
  }

  toggleSatellite(): boolean {
    this.setSatellite(!this.satOn);
    return this.satOn;
  }

  showPlace(place: Place, pad: { top: number; bottom: number }, animate: boolean): void {
    this.layer.clearLayers();
    const css = getComputedStyle(document.documentElement);
    const red = css.getPropertyValue('--red').trim();
    const circle = L.circle([place.lat, place.lng], {
      radius: RADIUS_KM * 1000,
      color: red,
      weight: 1.8,
      dashArray: '6 6',
      fillColor: red,
      fillOpacity: 0.05,
      interactive: false,
    }).addTo(this.layer);
    L.marker([place.lat, place.lng], {
      icon: L.divIcon({ className: 'map-pin', html: PIN_SVG, iconSize: [32, 44], iconAnchor: [16, 42] }),
      keyboard: false,
      interactive: false,
      title: 'Punto de la ronda',
    }).addTo(this.layer);
    this.map.invalidateSize();
    const bounds = circle.getBounds();
    const fit = { paddingTopLeft: L.point(24, pad.top), paddingBottomRight: L.point(24, pad.bottom), maxZoom: 7 };
    // Centro y zoom que dejan el círculo entre la cabecera y la mano (API interna estable de Leaflet 1.9).
    const target = (this.map as unknown as { _getBoundsCenterZoom(b: L.LatLngBounds, o: object): { center: L.LatLng; zoom: number } })._getBoundsCenterZoom(bounds, fit);
    const zoom = Math.max(4, Math.min(7, target.zoom));
    if (this.settle) clearTimeout(this.settle);
    if (animate) this.map.flyTo(target.center, zoom, { duration: 1.2 });
    else this.map.setView(target.center, zoom, { animate: false });
    // Si la animación se queda a medias (pestaña en segundo plano, gesto del jugador…), se coloca sin animar.
    this.settle = setTimeout(() => {
      if (Math.abs(this.map.getZoom() - zoom) > 0.5 || !this.map.getBounds().contains(target.center)) {
        this.map.setView(target.center, zoom, { animate: false });
      }
    }, animate ? 1800 : 0);
  }

  showRecords(points: [number, number][]): void {
    const css = getComputedStyle(document.documentElement);
    const moss = css.getPropertyValue('--moss').trim();
    const sheet = css.getPropertyValue('--sheet').trim();
    for (const p of points) {
      L.circleMarker(p, { radius: 4, color: sheet, weight: 1, fillColor: moss, fillOpacity: 0.95, interactive: false }).addTo(this.layer);
    }
  }

  reset(): void {
    this.layer.clearLayers();
    this.map.setView([25, 5], 2, { animate: false });
  }

  refresh(): void {
    this.map.invalidateSize();
  }
}
