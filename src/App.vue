<template>
  <div id="app" hidden>
    <Sidebar />
    <Map />
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
};
</script>

<style>
html {
  height: 100%;
}
body {
  height: 100%;
  margin: 0;
}
#app {
  height: 100%;
  display: flex;
  align-items: stretch;
  flex-direction: row;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>
