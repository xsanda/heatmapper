<template>
  <div id="app">
    <Sidebar
      :activities="activities"
      :selected.sync="selected"
      @zoom-to-selected="zoomToSelected"
      @clear-activities="clearActivities"
      @add-activities="addActivities"
      @add-activity-maps="addActivityMaps"
    />
    <MapComponent
      ref="map"
      :center.sync="location"
      :zoom.sync="zoom"
      :activities="activities"
      :selected.sync="selected"
    />
  </div>
</template>

<script lang="ts">
import { Component, Ref, Vue } from 'vue-property-decorator';

import type { Activity } from '../../shared/interfaces';
import MapComponent from './components/Map.vue';

@Component({
  components: {
    Sidebar: () => import('./components/Sidebar.vue'),
    MapComponent,
  },
})
export default class App extends Vue {
  @Ref() map!: Vue & { zoomToSelection(): void };

  location = { lat: 51.45, lng: -2.6 };

  zoom = 10;

  activities: Activity[] = [];

  selected: Activity[] = [];

  clearActivities(): void {
    this.activities = [];
  }

  addActivities(activities: Activity[]): void {
    const newIDs = new Set(activities.map((activity) => activity.id));
    this.activities = this.activities
      .filter((activity) => !newIDs.has(activity.id))
      .concat(activities)
      .sort((a, b) => b.id - a.id);
  }

  addActivityMaps(maps: never): void {
    Object.entries(maps).forEach(([activity, map]) => {
      const i = this.activities.findIndex(({ id }) => id.toString() === activity);
      this.$set(this.activities, i, { ...this.activities[i], map });
    });
  }

  zoomToSelected(selection: Activity[]): void {
    this.selected = selection;
    this.map.zoomToSelection();
  }
}
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

a {
  color: var(--link-color);
}

:root {
  --color: #222;
  --background: #fff;
  --background-slight: #eee;
  --background-strong: #ccc;
  --transition-speed: 0.5s;
  --link-color: blue;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color: #fff;
    --background: #222;
    --background-slight: #333;
    --background-strong: #555;
    --link-color: lightblue;
  }
}
</style>
