<template>
  <MglMap
    container="map-test"
    :center.sync="center"
    :accessToken="token"
    :mapStyle="mapStyle"
    :zoom="zoom"
  >
    <!-- <MglMarker :coordinates.sync="markerCoordinates" color="green" /> -->
    <!-- <MglGeojsonLayer
      type="fill"
      :sourceId="sourceId"
      :layerId="layerId"
      :source="geojson"
      @click="handleClick"
    /> -->
    <MglFullscreenControl position="top-right" /> <MglScaleControl />
  </MglMap>
</template>

<script lang="ts">
import { MglMap, MglScaleControl, MglFullscreenControl } from 'vue-mapbox';
export default {
  data() {
    return {
      token:
        'pk.eyJ1IjoiY2hhcmRpbmciLCJhIjoiY2tiYWp0cndkMDc0ZjJybXhlcHdoM2Z3biJ9.XUwOLV17ZBXE8dhp198dqg',
      center: [-2.6, 51.45],
      mapStyle: 'mapbox://styles/mapbox/outdoors-v11',
      zoom: 10,
    };
  },
  head: {
    link: [
      {
        href: 'https://api.tiles.mapbox.com/mapbox-gl-js/v0.53.0/mapbox-gl.css',
        rel: 'stylesheet',
      },
    ],
  },
  components: {
    MglMap,
    MglFullscreenControl,
    MglScaleControl,
  },
};
</script>

<style></style>
