<template>
  <div id="app">
    <HelloWorld msg="Welcome to Your Vue.js App" />
    <Map />
  </div>
</template>

<script lang="ts">
import HelloWorld from './components/HelloWorld.vue';
import Map from './components/Map.vue';

export default {
  name: 'App',
  components: {
    HelloWorld,
    Map,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>
