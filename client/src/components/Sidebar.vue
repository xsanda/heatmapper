<template>
  <div class="sidebar">
    <Form @loaded="loadedActivities" />
    <ul>
      <li
        v-for="activity of activities"
        :key="activity"
      >
        {{ activity }}
      </li>
    </ul>
  </div>
</template>

<script>
import Form from './Form.vue';

export default {
  name: 'Sidebar',
  components: { Form },
  data() {
    return {
      activities: [],
    };
  },
  methods: {
    loadedActivities(activities) {
      this.activities = activities;
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.sidebar {
  flex: 0 20em;
}
</style>
