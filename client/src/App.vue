<template>
  <div id="app">
    <Sidebar
      :activities="activities"
      :selected.sync="selected"
      @zoom-to-selected="zoomToSelected"
      @clear-activities="clearActivities"
      @add-activities="addActivities"
      @add-activity-maps="addActivityMaps"
      @toggle:improved-hillshade="improvedHillshade = !improvedHillshade"
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
import 'reflect-metadata';
import { Component, Vue, Ref } from 'vue-property-decorator';
import { Activity } from '../../shared/interfaces';
import MapComponent from './components/Map.vue';

@Component({
  components: {
    Sidebar: () => import('./components/Sidebar.vue'),
    Map: MapComponent,
  } as any,
})
export default class App extends Vue {
  @Ref() map!: MapComponent;

  location = { lat: 51.45, lng: -2.6 };

  zoom = 10;

  activities: Activity[] = [];

  selected: Activity[] = [];

  improvedHillshade = false;

  clearActivities() {
    this.activities = [];
  }

  addActivities(activities: Activity[]) {
    this.activities.push(...activities);
  }

  addActivityMaps(maps: never) {
    Object.entries(maps).forEach(([activity, map]) => {
      const i = this.activities.findIndex(({ id }) => id.toString() === activity);
      this.$set(this.activities, i, { ...this.activities[i], map });
    });
  }

  zoomToSelected(selection: Activity[]) {
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
