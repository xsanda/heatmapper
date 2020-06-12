<template>
  <mapbox
    container="map-test"
    :map-options="{ style: mapStyle, center, zoom }"
    :center="center"
    :access-token="token"
    :map-style="mapStyle"
    :zoom="zoom"
    @map-moveend="moveend"
    @map-zoomend="zoomend"
    @map-click="click"
    @map-load="mapLoaded"
    :fullscreen-control="{ show: true, position:'top-right' }"
    :scale-control="{ show: true, position:'bottom-left' }"
    :nav-control="{ show: false }"
  />
</template>

<script>
import Mapbox from 'mapbox-gl-vue';
import { LngLatBounds } from 'mapbox-gl';
import polyline from '@mapbox/polyline';

const fromZoom = (...pairs) => [
  'interpolate',
  ['linear'],
  ['zoom'],
  ...pairs.flatMap(([zoomLevel, value]) => [zoomLevel, value]),
];

const makeGeoJsonData = (activities = []) => ({
  type: 'FeatureCollection',
  features: activities
    .filter((activity) => activity.map)
    .map((activity) => ({
      type: 'Feature',
      id: activity.id,
      geometry: polyline.toGeoJSON(activity.map),
    })),

});

const makeGeoJson = (activities = []) => ({
  type: 'geojson',
  data: makeGeoJsonData(activities),
});

const sources = ['lines', 'selected'];
const layers = {
  blur: {
    source: 'lines',
    color: '#00F',
    opacity: 0.01,
    width: 10,
    blur: 10,
  },
  lines: {
    source: 'lines',
    color: '#00F',
    opacity: fromZoom(
      [5, 0.5],
      [10, 0.1],
      [16, 0.1],
      [22, 0.2],
    ),
    width: fromZoom(
      [5, 1],
      [17, 4],
      [22, 8],
    ),
  },
  selected: {
    source: 'selected',
    color: '#0F0',
    opacity: 1,
    width: fromZoom(
      [5, 4],
      [17, 8],
    ),
  },
};

const buildLineLayer = (id, layer) => ({
  id,
  type: 'line',
  source: layer.source,
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': layer.color,
    'line-opacity': layer.opacity,
    'line-width': layer.width,
    'line-blur': layer.blur || 0,
  },
});

export default {
  props: {
    activities: { type: Array, required: true },
    center: { type: Object, default: () => [0, 0] },
    zoom: { type: Number, default: 0 },
    selected: { type: Array, default: () => [] },
  },
  computed: {
    selectedActivities() {
      return this.activities.filter((activity) => this.selected.includes(activity.id));
    },
  },
  components: {
    Mapbox,
  },
  data() {
    return {
      token:
        'pk.eyJ1Ijoic3RyYXZhIiwiYSI6IlpoeXU2U0UifQ.c7yhlZevNRFCqHYm6G6Cyg',
      mapStyle: 'mapbox://styles/strava/ck2gt6oil0c7y1cnvlz1uphnu',
      localSelected: null,
    };
  },
  watch: {
    activities(next) {
      this.applyActivities(next, 'lines');
    },
    selectedActivities(next) {
      this.applyActivities(next, 'selected');
    },
    selected() {
      this.$nextTick(() => {
        if (this.selected !== this.localSelected) {
          this.localSelected = this.selected;
          this.flyTo(this.selectedActivities);
        }
      });
    },
  },
  methods: {
    flyTo(activities, zoom = false) {
      const { map } = this;
      if (!map || activities.length === 0) return;
      const coordinates = activities.flatMap(({ map: line }) => (
        polyline.decode(line).map((pair) => pair.reverse())
      ));
      const bounds = coordinates.reduce((acc, coord) => (
        acc.extend(coord)
      ), new LngLatBounds(coordinates[0], coordinates[0]));
      const padding = 20;
      const { width, height } = map.getCanvas().getBoundingClientRect();
      const screenNorthEast = map.unproject([width - padding, padding]);
      const screenSouthWest = map.unproject([padding, height - padding]);
      const screenBounds = new LngLatBounds(screenSouthWest, screenNorthEast);
      if (zoom
        || !screenBounds.contains(bounds.getSouthWest())
        || !screenBounds.contains(bounds.getNorthEast())) {
        const maxZoom = zoom ? 30 : map.getZoom();
        map.fitBounds(bounds, {
          padding,
          linear: true,
          maxZoom,
        });
      }
    },
    zoomToSelection() {
      this.flyTo(this.selectedActivities, true);
    },
    applyActivities(next, sourceID) {
      this.map?.getSource(sourceID).setData(makeGeoJsonData(next));
    },
    mapLoaded(map) {
      sources.forEach((id) => map.addSource(id, makeGeoJson()));
      Object.entries(layers).forEach(([id, layer]) => map.addLayer(buildLineLayer(id, layer)));
      this.map = map;
      this.$nextTick(() => {
        this.applyActivities(this.activities, 'lines');
        this.applyActivities(this.selectedActivities, 'selected');
      });
    },
    click(map, e) {
      const surround = (point, offset) => [
        { x: point.x - offset, y: point.y + offset },
        { x: point.x + offset, y: point.y - offset },
      ];
      let neighbours = [];
      for (let i = 0; i < 5; i += 1) {
        neighbours = map.queryRenderedFeatures(
          surround(e.point, i),
          { layers: ['lines', 'selected'] },
        );
        if (neighbours.length > 0) break;
      }
      if (neighbours.length > 0) {
        this.select(neighbours[neighbours.length - 1].id);
      } else this.select(null);
    },
    select(id) {
      const selected = [id];
      this.localSelected = selected;
      this.$emit('update:selected', selected);
    },
    zoomend(map) {
      this.$emit('update:zoom', map.getZoom());
    },
    moveend(map) {
      this.$emit('update:center', map.getCenter());
    },
  },
  head: {
    link: [
      {
        href: 'https://api.mapbox.com/mapbox-gl-js/v1.11.0/mapbox-gl.css',
        rel: 'stylesheet',
      },
    ],
  },
};
</script>

<style>
#map {
  flex: 1;
}

.mapboxgl-canvas {
  cursor:pointer;
}
</style>
