<template>
  <mgl-map
    container="map-test"
    :center="center"
    @update:center="$emit('update:center',$event)"
    :access-token="token"
    :map-style="mapStyle"
    :zoom="zoom"
    @update:zoom="$emit('update:zoom',$event)"
    @click="click"
    @load="mapLoaded"
  >
    <!-- <map-lines
      :activities="activities"
    />
    <map-lines
      :activities="selectedActivities"
      highlighted
    /> -->
    <mgl-fullscreen-control position="top-right" />
    <mgl-scale-control position="bottom-left" />
  </mgl-map>
</template>

<script>
import {
  MglMap, MglScaleControl, MglFullscreenControl,
} from 'vue-mapbox';
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
    selected: { type: Number, default: undefined },
  },
  computed: {
    selectedActivities() {
      return this.activities.filter((activity) => activity.id === this.selected);
    },
  },
  components: {
    MglMap,
    MglFullscreenControl,
    MglScaleControl,
  },
  data() {
    return {
      token:
        'pk.eyJ1IjoiY2hhcmRpbmciLCJhIjoiY2tiYWp0cndkMDc0ZjJybXhlcHdoM2Z3biJ9.XUwOLV17ZBXE8dhp198dqg',
      mapStyle: 'mapbox://styles/mapbox/outdoors-v11',
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
  },
  methods: {
    applyActivities(next, sourceID) {
      this.map?.getSource(sourceID).setData(makeGeoJsonData(next));
    },
    mapLoaded({ map, component: { mapbox } }) {
      this.mapbox = mapbox;
      sources.forEach((id) => map.addSource(id, makeGeoJson()));
      Object.entries(layers).forEach(([id, layer]) => map.addLayer(buildLineLayer(id, layer)));
      this.map = map;
      this.applyActivities(this.activities, 'lines');
      this.applyActivities(this.selected, 'selected');
    },
    click(e) {
      const surround = (point, offset) => [
        { x: point.x - offset, y: point.y + offset },
        { x: point.x + offset, y: point.y - offset },
      ];
      let neighbours = [];
      for (let i = 0; i < 5; i += 1) {
        neighbours = e.map.queryRenderedFeatures(
          surround(e.mapboxEvent.point, i),
          { layers: ['lines', 'selected'] },
        );
        if (neighbours.length > 0) break;
      }
      if (neighbours.length > 0) {
        this.select(neighbours[neighbours.length - 1].id);
      } else this.select(null);
    },
    select(id) {
      this.localSelected = id;
      this.$emit('update:selected', id);
    },
  },
  head: {
    link: [
      {
        href: 'https://api.tiles.mapbox.com/mapbox-gl-js/v0.53.0/mapbox-gl.css',
        rel: 'stylesheet',
      },
    ],
  },
};
</script>

<style>
.mapboxgl-canvas {
  cursor:pointer;
}
</style>
