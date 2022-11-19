'use strict';

// スロットリスト
const slot_list = [
	{
		key: 1,
		title: "スロット1"
	},
	{
		key: 2,
		title: "スロット2"
	},
	{
		key: 3,
		title: "スロット3"
	},
	{
		key: 4,
		title: "スロット4"
	},
	{
		key: 5,
		title: "スロット5"
	},
];

// リモコンキーリスト
const irkey_code = [
	// 1XX
	{
		key: 101,
		title: "音量アップ"
	},
	{
		key: 102,
		title: "音量ダウン"
	},

	// 2XX
	{
    key: 201,
    title: "戻る"
  },
  {
    key: 202,
    title: "進む"
  },
  {
    key: 203,
    title: "カーソル上"
  },
  {
    key: 204,
    title: "カーソル下"
  },
  {
    key: 205,
    title: "再生/一時停止"
  },
  {
    key: 206,
    title: "次の曲の再生"
  },
  {
    key: 207,
    title: "停止"
  },
];

const comp_config = {
  props: ['value'],
  mixins: [mixins_bootstrap],
  store: vue_store,
  template: `
  <div style="padding: 15px">
		<button class="btn btn-default btn-lg pull-right" v-on:click="$store.commit('page_change')">閉じる</button>
		<h1>Config Center</h1>

		<ul class="nav nav-tabs">
			<li class="active"><a href="#config_basic" data-toggle="tab">基本設定</a></li>
			<li><a href="#config_remocon" data-toggle="tab">リモコン設定</a></li>
		</ul>

		<div class="tab-content">

			<div id="config_basic" class="tab-pane fade in active">
				<br>
				<label>uuid</label> {{$store.state.uuid}}<br>
				<label>local ipaddress</label> {{$store.state.ipaddress}}<br>
			</div>

			<div id="config_remocon" class="tab-pane fade in">
				<span v-if="config">
					<br>
					<label>remocon ipaddress</label> {{config.remocon.ipaddress}}<br>
					<div class="form-inline">
						<label>remocon_list</label> <select class="form-control" v-model="remocon_update">
							<option v-for="(item, index) in remocon_list" v-bind:value="item.ipaddress">{{item.ipaddress}}</option>
						</select>
						<button class="btn btn-default" v-on:click="remocon_change">設定</button>
					</div>

					<h3>codelist</h3>
					<table class="table table-condensed">
						<thead>
							<tr><th>key</th><th>title</th><th>ircode</th><th>action</th></tr>
						</thead>
						<tbody>
							<tr v-for="(item, index) in config.remocon.codelist">
								<td><span v-if="item.key">{{item.key}}</span><span v-else>{{item.slot}}</span></td>
								<td><span v-if="item.key">{{key2title(item.key)}}</span><span v-else>{{slot2title(item.slot)}}</span></td>
								<td><label>decode_tye</label> {{item.ircode.decode_type}} <label>address</label> {{item.ircode.address}} <label>command</label> {{item.ircode.command}}</td>
								<td><button class="btn btn-default" v-on:click="codelist_delete(index)">削除</button></td>
							</tr>
						</tbody>
					</table>

					<h3>slots</h3>
					<table class="table table-condensed">
						<thead>
							<tr><th>key</th><th>title</th><th>rawbuf</th><th>action</th></tr>
						</thead>
						<tbody>
							<tr v-for="(item, index) in config.remocon.slots">
								<td>{{item.key}}</td><td>{{slot2title(item.key)}}</td>
								<td>{{item.ircode.rawbuf.slice(0, 30)}}...</td>
								<td><button class="btn btn-default" v-on:click="slot_delete(index)">削除</button></td>
							</tr>
						</tbody>
					</table>

					<h3>received_ircode</h3>
					<ul class="list-group">
						<li class="list-group-item" v-for="(item, index) in received_list">
							<div class="btn-group dropup pull-right">
								<button type="button" class="btn btn-default btn-lg dropdown-toggle" data-toggle="dropdown">リモコンキー登録<span class="caret"></span></button>
								<ul class="dropdown-menu">
									<li v-for="(item2, index2) in irkey_code"><a v-on:click="codelist_add(index, index2)">{{item2.title}}</a></li>
									<li v-for="(item2, index2) in slot_list"><a v-on:click="codelist_forward_add(index, index2)">{{item2.title}}</a></li>
								</ul>
							</div>
							<div class="btn-group dropup pull-right">
								<button type="button" class="btn btn-default btn-lg dropdown-toggle" data-toggle="dropdown">スロット登録<span class="caret"></span></button>
								<ul class="dropdown-menu">
									<li v-for="(item2, index2) in slot_list"><a v-on:click="slot_add(index, index2)">{{item2.title}}</a></li>
								</ul>
							</div>
							<label>decode_type</label> {{item.decode_type}} <label>address</label> {{item.address}} <label>command</label> {{item.command}}<br>
							<label>received_at</label> {{toLocaleTimeString(item.received_at)}}
						</li>
					</ul>
				</span>
			</div>

		</div>
			

		<button class="btn btn-default btn-lg pull-right" v-on:click="$store.commit('page_change')">閉じる</button>
		<br><br>

  </div>
  `,
  data: function () {
    return {
      config: null,
      remocon_update: "",
      remocon_list: [],
      received_list: [],
    }
  },
  methods: {
		// キーからキー名への変換
		key2title: function(key){
			const item = irkey_code.find(item => item.key == key);
			return item ? item.title : "Unknown";
		},
		slot2title: function(key){
			const item = slot_list.find(item => item.key == key);
			return item ? item.title : "Unknown";
		},

		// リモコンIPアドレスの変更
		remocon_change: async function(){
			if( !confirm("本当に設定しますか？"))
				return;
			this.config.remocon.ipaddress = this.remocon_update;
			await this.config_set();
		},

		// リモコンコードの追加
		codelist_add: async function(index, index2){
			if( !confirm("登録しますか？"))
				return;
			const item = this.config.remocon.codelist.find(item =>
					item.ircode.decode_type == this.received_list[index].decode_type && item.ircode.address == this.received_list[index].address && item.ircode.command == this.received_list[index].command );
			if( item ){
				alert('すでに同じコードを登録済みです。');
				return;
			}

			const code = {
				ircode: {
					decode_type: this.received_list[index].decode_type,
					address: this.received_list[index].address,
					command: this.received_list[index].command,
				},
				key: irkey_code[index2].key
			};
			this.config.remocon.codelist.push(code);
			await this.config_set();
		},

		// リモコンコード(赤外線転送)の追加
		codelist_forward_add: async function(index, index2){
			if( !confirm("登録しますか？"))
				return;
			const item = this.config.remocon.codelist.find(item =>
					item.ircode.decode_type == this.received_list[index].decode_type && item.ircode.address == this.received_list[index].address && item.ircode.command == this.received_list[index].command );
			if( item ){
				alert('すでに同じコードを登録済みです。');
				return;
			}

			const slot = this.config.remocon.slots.find(item2 => item2.key == slot_list[index2].key);
			if( !slot ){
				alert('スロットが未登録です。');
				return;
			}

			const code = {
				ircode: {
					decode_type: this.received_list[index].decode_type,
					address: this.received_list[index].address,
					command: this.received_list[index].command,
				},
				slot: slot.key
			};
			this.config.remocon.codelist.push(code);
			await this.config_set();
		},

		// スロットの追加
		slot_add: async function(index, index2){
			if( !confirm("登録しますか？"))
				return;
			const item = this.config.remocon.slots.find(item =>	item.key == irkey_code[index2].key);
			if( item ){
				alert('すでに同じスロットを登録済みです。');
				return;
			}

			const slot = {
				ircode: {
					rawbuf: this.received_list[index].rawbuf
				},
				key: slot_list[index2].key
			};
			this.config.remocon.slots.push(slot);
			await this.config_set();
		},

		// スロットの削除
		slot_delete: async function(index){
			if( !confirm("本当に削除しますか？"))
				return;
			this.config.remocon.slots.splice(index, 1);
			await this.config_set();
		},

		// リモコンコードの削除
		codelist_delete: async function(index){
			if( !confirm("本当に削除しますか？"))
				return;
			this.config.remocon.codelist.splice(index, 1);
			await this.config_set();
		},

		// 端末設定のアップロード
		config_set: async function(){
			const params = {
				uuid: this.$store.state.uuid,
				ipaddress: this.$store.state.ipaddress,
				config: this.config
			};
			let result = await do_post(BASE_URL + "/csd-set-config", params);
			console.log(result);
			this.$store.state.config = this.config;
		},

	//  リモコンキー受信した
		onIrReceived: async function(payload){
			payload.received_at = new Date().getTime();
			this.received_list.unshift(payload);
		},

    // ページが選択された
    onSelected: async function(){
			let result = await do_post(BASE_URL + "/csd-get-remoconlist");
			console.log(result);
			this.remocon_list = result.list;
			this.config = JSON.parse(JSON.stringify(this.$store.state.config));
			this.received_list = [];
    },

    // Cordova初期化処理が完了した
    onDeviceReady: async function(){
      console.log('page_config onDeviceReady called');

      // 設定値の取得・反映
      try{
        const params = {
          uuid: this.$store.state.uuid,
          ipaddress: this.$store.state.ipaddress
        };
        let result = await do_post(BASE_URL + "/csd-get-config", params);
        console.log(result);
        this.$store.state.config = result.config;
      }catch(error){
        const params = {
          uuid: this.$store.state.uuid,
          ipaddress: this.$store.state.ipaddress,
          config: this.$store.state.config
        };
        let result = await do_post(BASE_URL + "/csd-set-config", params);
        console.log(result);
      }
		},
  },
  mounted: function(){
    console.log('config mounted');
  }
}
