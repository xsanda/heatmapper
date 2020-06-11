<template>
  <mgl-geojson-layer
    type="fill"
    :layer-id="layer.id"
    :source-id="id"
    :source="geoJson"
    :layer="layer"
  />
</template>

<script>
import { MglGeojsonLayer } from 'vue-mapbox';

import polyline from '@mapbox/polyline';

export default {
  props: {
    activities: { type: Array, required: true },
    highlighted: { type: Boolean, default: false },
  },
  components: { MglGeojsonLayer },
  computed: {
    id() {
      return this.highlighted ? 'selected' : 'lines';
    },
    geoJson() {
      return {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features:
            this.activities
              .filter((activity) => activity.map !== null)
              .map((activity) => ({
                type: 'Feature',
                id: activity.id,
                geometry: polyline.toGeoJSON(activity.map),
              })),
        },
      };
    },
    layer() {
      return {
        id: this.id,
        type: 'line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': this.highlighted ? '#0F0' : '#00F',
          'line-opacity': this.highlighted ? 1 : [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0.5,
            10,
            0.1,
            17,
            0.1,
            22,
            0.2,
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            this.highlighted ? 4 : 1,
            17,
            this.highlighted ? 8 : 4,
            22,
            this.highlighted ? 8 : 8,
          ],
        },
      };
    },
  },
};
</script>

<style>
.mapboxgl-canvas {
  cursor: pointer;
}
</style>
