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
  >
    <!-- <map-line
      v-for="activity of activities"
      :activity="activity"
      :key="activity.id"
    /> -->
    <map-lines
      :activities="unselectedActivities"
    />
    <map-lines
      :activities="selectedActivities"
      highlighted
    />
    <mgl-fullscreen-control position="top-right" />
    <mgl-scale-control position="bottom-left" />
  </mgl-map>
</template>

<script>
import {
  MglMap, MglScaleControl, MglFullscreenControl,
} from 'vue-mapbox';
import MapLines from './MapLines.vue';

export default {
  props: {
    activities: { type: Array, required: true },
    center: { type: Object, default: () => [0, 0] },
    zoom: { type: Number, default: 0 },
    selected: { type: Number, default: undefined },
  },
  computed: {
    unselectedActivities() {
      return this.activities.filter((activity) => activity.id !== this.selected);
    },
    selectedActivities() {
      return this.activities.filter((activity) => activity.id === this.selected);
    },
  },
  components: {
    MglMap,
    MglFullscreenControl,
    MglScaleControl,
    MapLines,
  },
  data() {
    return {
      token:
        'pk.eyJ1IjoiY2hhcmRpbmciLCJhIjoiY2tiYWp0cndkMDc0ZjJybXhlcHdoM2Z3biJ9.XUwOLV17ZBXE8dhp198dqg',
      mapStyle: 'mapbox://styles/mapbox/outdoors-v11',
    };
  },
  methods: {
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
        this.select(neighbours[0].id);
      } else this.select(undefined);
    },
    select(id) {
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

<style></style>
