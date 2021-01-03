<!-- From https://acdcjunior.github.io/how-bind-date-object-to-input-date-vue.js-v-model.html -->
<template>
  <input type="date" ref="input" :name="name" :value="dateToYYYYMMDD(value)" @input="updateValue" />
</template>
<script lang="ts">
import { Component, Vue, Prop, Ref } from 'vue-property-decorator';

@Component
export default class InputDate extends Vue {
  @Prop({ default: null }) value!: Date;

  @Prop({ default: undefined }) name?: string;

  @Ref() input!: HTMLInputElement;

  // Set to the start of the day provided, in local time
  dateToYYYYMMDD(d: Date) {
    // alternative implementations in https://stackoverflow.com/q/23593052/1850609
    return (
      d && new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000).toISOString().split('T')[0]
    );
  }

  updateValue() {
    this.$emit('input', this.input.valueAsDate);
  }
}
</script>
