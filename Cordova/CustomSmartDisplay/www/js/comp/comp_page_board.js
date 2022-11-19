'use strict';

const comp_board = {
  props: ['value'],
  mixins: [mixins_bootstrap],
  store: vue_store,
  template: `
  <div style="padding: 15px">
    <button class="btn btn-default btn-lg pull-right" v-on:click="$store.commit('page_change')">閉じる</button>
    <h1>掲示板</h1>

    <div class="input-group input-group-lg">
      <div class="input-group-btn">
        <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown"> {{from_displayName}} <span class="caret"></span></button>
        <ul class="dropdown-menu">
          <li v-for="(item, index) in $store.state.config.displayName_list"><a v-on:click="set_displayName('from', item)">{{item}}</a></li>
        </ul>
      </div>
      <span class="input-group-addon">→</span>
      <div class="input-group-btn">
        <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown"> {{to_displayName}} <span class="caret"></span></button>
        <ul class="dropdown-menu">
          <li><a v-on:click="set_displayName('to', 'みんな')">みんな</a></li>
          <li v-for="(item, index) in $store.state.config.displayName_list"><a v-on:click="set_displayName('to', item)">{{item}}</a></li>
        </ul>
      </div>
      <input type="text" class="form-control" v-model="message">
      <div class="input-group-btn">
        <button class="btn btn-primary" v-on:click="board_add">投稿</button>
      </div>
    </div>

    <br>
    <div class="row" style="margin: 15px">
      <div class="col-xs-2 form-inline">
        from:<br>
        <select class="form-control" v-model="from_filter" v-on:change="board_filter_change">
          <option value="*">*</option>
          <option v-for="(item, index) in $store.state.config.displayName_list" v-bind:value="item">{{item}}</option>
          <option value="その他">その他</option>
        </select><br>
        to:<br>
        <select class="form-control" v-model="to_filter" v-on:change="board_filter_change">
          <option value="*">*</option>
          <option v-for="(item, index) in $store.state.config.displayName_list" v-bind:value="item">{{item}}</option>
          <option value="みんな">みんな</option>
          <option value="その他">その他</option>
        </select>
      </div>
      <div class="col-xs-10">
        <div class="panel panel-default" v-for="(item, index) in board_list">
          <div class="panel-heading">
            <div class="pull-right">{{toLocaleString(item.received_at)}}</div>
            <small>from:</small>{{item.who_from}} <small>to:</small>{{item.who_to}}
          </div>
          <div class="panel-body">
            <p>{{item.message}}</p>
          </div>
        </div>
      </div>
    </div>

    <button class="btn btn-default btn-lg pull-right" v-on:click="$store.commit('page_change')">閉じる</button>
    <br><br>
  </div>
  `,
  data: function () {
    return {
      from_displayName: "",
      to_displayName: "",
      message: '',
      board_list: [],
      to_filter: "*",
      from_filter: "*",
    }
  },
  methods: {
    set_displayName: function(tofrom, displayName){
      if( tofrom == "to" )
        this.to_displayName = displayName;
      else if( tofrom == "from" )
        this.from_displayName = displayName;
    },

    board_add: async function(){
      if( !this.message ){
        alert("メッセージを入力してください。");
        return;
      }
      var params = {
        uuid: this.$store.state.uuid,
        from: this.from_displayName,
        to: this.to_displayName,
        message: this.message
      };
			let result = await do_post(BASE_URL + "/csd-add-board", params);
			console.log(result);
      this.message = "";
      await this.board_update();
    },

    board_update: async function(){
			let result = await do_post(BASE_URL + "/csd-get-board");
			console.log(result);
      this.total_list = result.rows;
      this.board_filter_change();
    },

    board_filter_change: function(){
			var list = this.total_list.filter( item =>{
        var other_from = this.$store.state.config.displayName_list.find(item2 => item2 == item.who_from) ? false : ((item.who_from == 'みんな') ? false : true);
        var other_to = this.$store.state.config.displayName_list.find(item2 => item2 == item.who_to) ? false : ((item.who_to == 'みんな') ? false : true);
        if(this.from_filter == '*' || this.from_filter == item.who_from || (this.from_filter == 'その他' && other_from))
          if(this.to_filter == '*' || this.to_filter == item.who_to || (this.to_filter == 'その他' && other_to))
            return true;
        return false;
      });
      this.board_list = list;
    },

    // ページが選択された
    onSelected: async function(){
      await this.board_update();
    },
  },
  mounted: function(){
    console.log('board mounted');
  }
}
