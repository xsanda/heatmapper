<script lang="tsx">
import polyline from '@mapbox/polyline';
import type Activity from '@strava-heatmapper/shared/interfaces/Activity';
import type { GeoJSON } from 'geojson';
import mapboxgl, { LngLatBounds } from 'mapbox-gl';
import type { VNode } from 'vue';
import { Component, Emit, Prop, PropSync, Ref, Vue, Watch } from 'vue-property-decorator';

declare global {
  interface Window {
    cachedMapComponent?: Map;
  }
}

const fromZoom = (...pairs: [number, number][]): mapboxgl.Expression => [
  'interpolate',
  ['linear'],
  ['zoom'],
  ...pairs.flatMap(([zoomLevel, value]) => [zoomLevel, value]),
];

const makeGeoJsonData = (activities: Activity[] = []): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: activities
    .filter((activity) => activity.map)
    .map((activity) => ({
      type: 'Feature',
      id: activity.id,
      properties: null,
      geometry: polyline.toGeoJSON(activity.map),
    })),
});

const makeGeoJson = (activities = []): mapboxgl.GeoJSONSourceRaw => ({
  type: 'geojson',
  data: makeGeoJsonData(activities),
});

const sources = ['lines', 'selected'];
const layers = {
  lines: {
    source: 'lines',
    color: '#00F',
    opacity: fromZoom([5, 0.75], [10, 0.35]),
    width: fromZoom([5, 1], [17, 4], [22, 8]),
  },
  medium: {
    source: 'lines',
    color: '#F00',
    opacity: fromZoom([5, 0.2], [10, 0.08]),
    width: fromZoom([5, 1], [17, 4], [22, 8]),
  },
  hot: {
    source: 'lines',
    color: '#FF0',
    opacity: fromZoom([5, 0.1], [10, 0.04]),
    width: fromZoom([5, 1], [17, 4], [22, 8]),
  },
  selected: {
    source: 'selected',
    color: '#0CF',
    opacity: 1,
    width: fromZoom([5, 4], [17, 8]),
  },
};

type LayerDef = typeof layers[keyof typeof layers];

const buildLineLayer = (id: string, layer: LayerDef): mapboxgl.AnyLayer => ({
  id,
  type: 'line',
  source: layer.source,
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': layer.color,
    'line-opacity': layer.opacity,
    'line-width': layer.width,
  },
});

@Component({
  head: {
    link: [
      {
        href: 'https://api.mapbox.com/mapbox-gl-js/v1.11.0/mapbox-gl.css',
        rel: 'stylesheet',
      },
    ],
  },
})
export default class Map extends Vue {
  render(): VNode {
    return (
      <div class="map-container" ref="container">
        {!window.cachedMapComponent && <div id="map" ref="mapElem" />}
      </div>
    );
  }

  @PropSync('center', { required: true }) modelCenter!: mapboxgl.LngLatLike;

  @PropSync('zoom', { default: 0 }) modelZoom!: number;

  @PropSync('selected', { default: () => [] }) modelSelected!: number[];

  @Prop({ required: true }) readonly activities!: Activity[];

  @Ref() container!: HTMLDivElement;

  @Ref() mapElem!: HTMLDivElement;

  get selectedActivities(): Activity[] {
    return this.activities.filter((activity) => this.modelSelected.includes(activity.id));
  }

  token =
    'pk.eyJ1IjoiY2hhcmRpbmciLCJhIjoiY2tiYWp0cndkMDc0ZjJybXhlcHdoM2Z3biJ9.XUwOLV17ZBXE8dhp198dqg';

  mapStyle =
    // 'https://s3-eu-west-1.amazonaws.com/tiles.os.uk/v2/styles/open-zoomstack-outdoor/style.json';
    'mapbox://styles/charding/ckbfof39h4b2t1ildduhwlm15';

  localSelected?: number[];

  map?: mapboxgl.Map = undefined;

  @Watch('mapStyle') onMapStyle(style: string): void {
    this.map?.setStyle(style);
  }

  @Watch('activities') onActivities(activities: Activity[]): void {
    this.applyActivities(activities, 'lines');
  }

  @Watch('selectedActivities') onSelectedActivities(selectedActivities: Activity[]): void {
    this.applyActivities(selectedActivities, 'selected');
  }

  @Watch('selected') onSelected(): void {
    this.$nextTick(() => {
      if (this.modelSelected !== this.localSelected) {
        this.localSelected = this.modelSelected;
        this.flyTo(this.selectedActivities);
      }
    });
  }

  flyTo(activities: Activity[], zoom = false): void {
    const padding = 20;

    const { map } = this;

    if (!map || activities.length === 0) return;
    const coordinates = activities.flatMap(({ map: line }) =>
      polyline.decode(line).map<[number, number]>(([y, x]) => [x, y]),
    );
    const bounds = coordinates.reduce(
      (acc, coord) => acc.extend(coord),
      new LngLatBounds(coordinates[0], coordinates[0]),
    );
    const { width, height } = map.getCanvas().getBoundingClientRect();
    const screenNorthEast = map.unproject([width - padding, padding]);
    const screenSouthWest = map.unproject([padding, height - padding]);
    const screenBounds = new LngLatBounds(screenSouthWest, screenNorthEast);
    if (
      zoom ||
      !screenBounds.contains(bounds.getSouthWest()) ||
      !screenBounds.contains(bounds.getNorthEast())
    ) {
      const maxZoom = zoom ? 30 : map.getZoom();
      map.fitBounds(bounds, {
        padding,
        linear: true,
        maxZoom,
      });
    }
  }

  zoomToSelection(): void {
    this.flyTo(this.selectedActivities, true);
  }

  applyActivities(next: Activity[], sourceID: string): void {
    const source = this.map?.getSource(sourceID);
    (source as mapboxgl.GeoJSONSource)?.setData(makeGeoJsonData(next));
  }

  async mapLoaded(map: mapboxgl.Map): Promise<void> {
    map.resize();

    sources.forEach((id) => map.addSource(id, makeGeoJson()));
    Object.entries(layers).forEach(([id, layer]) => map.addLayer(buildLineLayer(id, layer)));

    await this.$nextTick();
    this.applyActivities(this.activities, 'lines');
    this.applyActivities(this.selectedActivities, 'selected');
  }

  click(map: mapboxgl.Map, e: mapboxgl.MapMouseEvent): void {
    const surround = (
      point: mapboxgl.Point,
      offset: number,
    ): [mapboxgl.PointLike, mapboxgl.PointLike] => [
      [point.x - offset, point.y + offset],
      [point.x + offset, point.y - offset],
    ];
    for (let i = 0; i < 5; i += 1) {
      const neighbours = map.queryRenderedFeatures(surround(e.point, i), {
        layers: ['lines', 'selected'],
      });
      if (neighbours.length > 0) {
        this.select(neighbours[neighbours.length - 1].id as number);
        return;
      }
    }
    this.select();
  }

  select(id?: number): void {
    const selected = id !== undefined ? [id] : [];
    this.localSelected = selected;
    this.modelSelected = selected;
  }

  zoomend(map: mapboxgl.Map): void {
    this.modelZoom = map.getZoom();
  }

  @Emit('update:center')
  moveend(map: mapboxgl.Map): mapboxgl.LngLat {
    return map.getCenter();
  }

  mounted(): void {
    let map: mapboxgl.Map;
    const cachedMap = window.cachedMapComponent?.map;
    if (cachedMap) {
      this.container.appendChild(cachedMap.getContainer());
      map = cachedMap;
    } else {
      map = new mapboxgl.Map({
        accessToken: this.token,
        container: this.mapElem,
        style: this.mapStyle,
        center: this.modelCenter,
        zoom: this.modelZoom,
      });
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
      map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
    }
    this.map = map;

    // Always delegate to the correct instance
    window.cachedMapComponent = this;
    this.map.on('zoomend', () => window.cachedMapComponent?.zoomend(map));
    this.map.on('moveend', () => window.cachedMapComponent?.moveend(map));
    this.map.on('click', (ev) => window.cachedMapComponent?.click(map, ev));
    this.map.on('load', () => window.cachedMapComponent?.mapLoaded(map));
  }
}
</script>

<style>
.map-container {
  display: contents;
}
#map {
  flex: 1;
  z-index: 0;
}

.mapboxgl-canvas {
  cursor: pointer;
  outline: none;
}
</style>
