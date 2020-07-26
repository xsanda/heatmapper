<template>
  <div id="app" hidden>
    <Sidebar
      :activities="activities"
      v-model:selected="selected"
      @zoom-to-selected="zoomToSelected"
      @clear-activities="clearActivities"
      @add-activities="addActivities"
      @add-activity-maps="addActivityMaps"
      @toggle:improved-hillshade="improvedHillshade = !improvedHillshade"
    />
    <Map
      v-model:center="location"
      v-model:zoom="zoom"
      :activities="activities"
      v-model:selected="selected"
      :improved-hillshade="improvedHillshade"
      ref="map"
    />
  </div>
</template>

<script>
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

:root {
  --color: #222;
  --background: #fff;
  --background-slight: #eee;
  --background-strong: #ccc;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color: #fff;
    --background: #222;
    --background-slight: #333;
    --background-strong: #555;
  }
}
</style>
