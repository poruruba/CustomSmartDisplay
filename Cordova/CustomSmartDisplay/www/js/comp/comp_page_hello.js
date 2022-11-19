'use strict';

const comp_hello = {
  props: ['value'],
  mixins: [mixins_bootstrap],
  store: vue_store,
  template: `
  <div style="padding: 15px">
    <button class="btn btn-default btn-lg pull-right" v-on:click="$store.commit('page_change')">閉じる</button>
    
    <h1>Hello World</h1>

    <p>
      <label>閲覧回数</label> {{counter}}
    </p>
  </div>
  `,
  data: function () {
    return {
      counter: 0
    }
  },
  methods: {
    // ページが選択された
    onSelected: async function(){
      this.counter++;
    },
  },
  mounted: function(){
    console.log('hello mounted');
  }
}
