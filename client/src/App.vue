<template>
  <div
    id="app"
    hidden
  >
    <Sidebar
      :activities.sync="activities"
      :selected.sync="selected"
    />
    <Map
      :center.sync="location"
      :zoom.sync="zoom"
      :activities="activities"
      :selected.sync="selected"
    />
  </div>
</template>

<script lang="ts">
import Sidebar from './components/Sidebar.vue';
import Map from './components/Map.vue';

export default {
  name: 'App',
  components: {
    Sidebar,
    Map,
  },
  data() {
    return {
      location: { lat: 51.45, lng: -2.6 },
      zoom: 10,
      activities: [],
      selected: undefined,
    };
  },
};
</script>

<style>
html,body {
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
