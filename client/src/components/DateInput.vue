<!-- From https://acdcjunior.github.io/how-bind-date-object-to-input-date-vue.js-v-model.html -->
<template>
  <div class="date-input">
    <input
      ref="input"
      type="date"
      :name="name"
      :value="dateToYYYYMMDD(value)"
      @change="updateValue"
    />
    <Icon class="icon"> expand_more </Icon>
  </div>
</template>
<script lang="ts">
import { Component, Emit, Prop, Ref, Vue } from 'vue-property-decorator';

import Icon from './Icon.vue';

@Component({ components: { Icon } })
export default class InputDate extends Vue {
  @Prop({ default: null }) value!: Date;

  @Prop({ default: undefined }) name?: string;

  @Ref() input!: HTMLInputElement;

  // Set to the start of the day provided, in local time
  dateToYYYYMMDD(date: Date | null): string | null {
    // alternative implementations in https://stackoverflow.com/q/23593052/1850609
    return (
      date &&
      new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000).toISOString().split('T')[0]
    );
  }

  @Emit('input')
  updateValue(): Date | null {
    const rawDate = this.input.valueAsDate;
    return rawDate && new Date(rawDate.getTime() + rawDate.getTimezoneOffset() * 60 * 1000);
  }
}
</script>

<style lang="scss" scoped>
.date-input {
  display: flex;
  margin: 1ex;

  border-radius: 0.3em;
  border: 1px solid gray;
  background-color: var(--background-slight);

  max-width: max-content;
  min-width: 3em;
}

input {
  background-color: inherit;
  border: none;
  border-radius: 0.3em;
  margin: 0.5em 1em;
  color: var(--color);
  appearance: none;

  &:focus {
    outline: none;
  }
}

@supports not (-webkit-touch-callout: none) {
  .icon {
    display: none;
  }
}
</style>
