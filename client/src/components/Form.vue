<template>
  <aside>
    <div class="grid">
      <label>
        <span>Start date</span>
        <input
          v-model="start"
          name="start"
          type="date"
        >
      </label>
      <label>
        <span>End date</span>
        <input
          v-model="end"
          name="end"
          type="date"
        >
      </label>
      <label>
        <span>Activity type</span>
        <div>
          <select v-model="activityType">
            <option
              selected
              value=""
            >All activities</option>
            <option
              v-for="[x, y] of activityTypes"
              :key="x"
              :value="x"
            >{{ y }}</option>
          </select>
        </div>
      </label>
    </div>
    <button @click="load">
      Load
    </button>
  </aside>
</template>

<script>
import activityTypes from '../activityTypes';

export default {
  name: 'Form',
  data() {
    return {
      start: undefined,
      end: null,
      activityType: '',
      activityTypes: Object.entries(activityTypes).sort((a, b) => a[1].localeCompare(b[1])),
    };
  },
  methods: {
    async load() {
      const qs = new URLSearchParams();
      const params = { type: this.activityType };
      Object.keys(params).forEach((key) => qs.append(key, params[key]));
      const res = await fetch(`/api/activities?${qs}`);
      const activities = await res.json();
      this.$emit('loaded', activities);
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.grid {
  display: table;

  > * {
    display: table-row;

    > * {
      display: table-cell;
    }
  }
}

aside > button {
  margin: 5px auto;
  display: block;
}
</style>
