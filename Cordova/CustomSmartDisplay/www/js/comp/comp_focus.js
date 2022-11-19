'use strict';

const comp_focus = {
  props: ['focus_id', 'current_focus_id', 'value'],
  mixins: [mixins_bootstrap],
  template: `
  <span v-bind:class="{ 'focus-current': focus_id == current_focus_id }">
    <slot></slot>
  </span>
  `,
  data: function () {
    return {
    }
  },
  methods: {
  },
  mounted: async function(){
  }
}
