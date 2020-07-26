<template>
  <Mapbox
    container="map-test"
    :map-options="{ style: mapStyle, center: modelCenter, zoom }"
    :center="modelCenter"
    :access-token="token"
    :map-style="mapStyle"
    :zoom="zoom"
    @map-moveend="moveend"
    @map-zoomend="zoomend"
    @map-click="click"
    @map-load="mapLoaded"
    :fullscreen-control="{ show: true, position: 'top-right' }"
    :scale-control="{ show: true, position: 'bottom-left' }"
    :nav-control="{ show: false }"
  />
</template>

<script>
import Mapbox from 'mapbox-gl-vue';
import { LngLatBounds } from 'mapbox-gl';
import polyline from '@mapbox/polyline';

import { useModelWrapper } from '../lib/modelWrapper';

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
    color: '#0F0',
    opacity: 1,
    width: fromZoom([5, 4], [17, 8]),
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
  name: 'Map',
  props: {
    activities: { type: Array, required: true },
    center: { type: Array, default: () => [0, 0] },
    zoom: { type: Number, default: 0 },
    selected: { type: Array, default: () => [] },
    improvedHillshade: { type: Boolean, default: false },
  },
  setup(props, { emit }) {
    return {
      modelCenter: useModelWrapper(props, emit, 'center'),
      modelZoom: useModelWrapper(props, emit, 'zoom'),
      modelSelected: useModelWrapper(props, emit, 'selected'),
    };
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
        'pk.eyJ1IjoiY2hhcmRpbmciLCJhIjoiY2tiYWp0cndkMDc0ZjJybXhlcHdoM2Z3biJ9.XUwOLV17ZBXE8dhp198dqg',
      // mapStyle:
      //   'https://s3-eu-west-1.amazonaws.com/tiles.os.uk/v2/styles/open-zoomstack-outdoor/style.json',
      mapStyle: 'mapbox://styles/charding/ckbfof39h4b2t1ildduhwlm15',
      localSelected: null,
      // TODO: this line breaks it
      // map: null,
    };
  },
  watch: {
    mapStyle(style) {
      this.map?.setStyle(style);
    },
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
    improvedHillshade(next) {
      if (this.map) this.setHillshade(next);
    },
  },
  methods: {
    setHillshade(improved) {
      this.map.setLayoutProperty(
        'improved-hillshading',
        'visibility',
        improved ? 'visible' : 'none',
      );
      this.map.setLayoutProperty('hillshade-greys', 'visibility', !improved ? 'visible' : 'none');
    },
    flyTo(activities, zoom = false) {
      const { map } = this;
      if (!map || activities.length === 0) return;
      const coordinates = activities.flatMap(({ map: line }) =>
        polyline.decode(line).map((pair) => pair.reverse()),
      );
      const bounds = coordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new LngLatBounds(coordinates[0], coordinates[0]),
      );
      const padding = 20;
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
    },
    zoomToSelection() {
      this.flyTo(this.selectedActivities, true);
    },
    applyActivities(next, sourceID) {
      this.map?.getSource(sourceID).setData(makeGeoJsonData(next));
    },
    mapLoaded(map) {
      // // eslint-disable-next-line no-restricted-syntax
      // for (const id of sources) {
      //   console.log('Adding source', id, makeGeoJson());
      //   map.addSource(id, makeGeoJson());
      //   // eslint-disable-next-line no-await-in-loop
      //   await new Promise((res) => setTimeout(res, 500));
      // }
      sources.forEach((id) => map.addSource(id, makeGeoJson()));
      // // map.addSource('global-heatmap', {
      // //   type: 'raster',
      // //   tiles: [
      // //     'https://heatmap-external-a.strava.com/tiles-auth/run/mobileblue/{z}/{x}/{y}.png',
      // //     'https://heatmap-external-b.strava.com/tiles-auth/run/mobileblue/{z}/{x}/{y}.png',
      // //     'https://heatmap-external-c.strava.com/tiles-auth/run/mobileblue/{z}/{x}/{y}.png',
      // //   ],
      // //   tileSize: 256,
      // //   attribution: 'Blue heatmap by Strava.',
      // // });
      Object.entries(layers).forEach(([id, layer]) =>
        map.addLayer(buildLineLayer(id, layer), layer.below),
      );
      // // map.addLayer({
      // //   id: 'global-heatmap',
      // //   type: 'raster',
      // //   source: 'global-heatmap',
      // //   minzoom: 0,
      // //   maxzoom: 15,
      // // });
      this.map = map;
      this.setHillshade(this.improvedHillshade);
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
        neighbours = map.queryRenderedFeatures(surround(e.point, i), {
          layers: ['lines', 'selected'],
        });
        if (neighbours.length > 0) break;
      }
      if (neighbours.length > 0) {
        this.select(neighbours[neighbours.length - 1].id);
      } else this.select(null);
    },
    select(id) {
      const selected = [id];
      this.localSelected = selected;
      this.modelSelected.value = selected;
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
  cursor: pointer;
}
</style>
