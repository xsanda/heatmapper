<!-- From https://acdcjunior.github.io/how-bind-date-object-to-input-date-vue.js-v-model.html -->
<template>
  <input
    ref="input"
    type="date"
    :name="name"
    :value="dateToYYYYMMDD(value)"
    @change="updateValue"
  />
</template>
<script lang="ts">
import { Component, Emit, Prop, Ref, Vue } from 'vue-property-decorator';

@Component
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
