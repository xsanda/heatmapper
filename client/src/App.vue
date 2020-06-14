<template>
  <div id="app" hidden>
    <Sidebar
      :activities="activities"
      :selected.sync="selected"
      @zoomToSelected="zoomToSelected"
      @clearActivities="clearActivities"
      @addActivities="addActivities"
      @addActivityMaps="addActivityMaps"
      @toggle:improvedHillshade="improvedHillshade = !improvedHillshade"
    />
    <Map
      :center.sync="location"
      :zoom.sync="zoom"
      :activities="activities"
      :selected.sync="selected"
      :improved-hillshade="improvedHillshade"
      ref="map"
    />
  </div>
</template>

<script lang="ts">
import Sidebar from './components/Sidebar.vue';

export default {
  name: 'App',
  components: {
    Sidebar,
    Map: () => import('./components/Map.vue'),
  },
  data() {
    return {
      location: { lat: 51.45, lng: -2.6 },
      zoom: 10,
      activities: [],
      selected: [],
      improvedHillshade: false,
    };
  },
  methods: {
    clearActivities() {
      this.activities = [];
    },
    addActivities(activities) {
      this.activities.push(...activities);
    },
    addActivityMaps(maps) {
      Object.entries(maps).forEach(([activity, map]) => {
        const i = this.activities.findIndex(({ id }) => id.toString() === activity);
        this.$set(this.activities, i, { ...this.activities[i], map });
      });
    },
    zoomToSelected(selection) {
      this.selected = selection;
      this.$refs.map.zoomToSelection();
    },
  },
};
</script>

<style>
html,
body {
  height: 100%;
  overflow: hidden;
  margin: 0;
}
#app {
  height: 100%;
  display: flex;
  align-items: stretch;
  flex-direction: row;
  font-family: -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>
