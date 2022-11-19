'use strict';

const comp_music = {
  props: ['value'],
  mixins: [mixins_bootstrap],
  store: vue_store,
  template: `
  <div style="padding: 15px">
    <button class="btn btn-default btn-lg pull-right" v-on:click="$store.commit('page_change')">閉じる</button>
    <h1>Music Center</h1>
    <span v-if="$store.state.music.status">
      <button class="btn btn-default btn-sm pull-right" v-on:click="music_stop"><span class="glyphicon glyphicon-stop"></span></button>
      <button class="btn btn-default btn-sm pull-right" v-on:click="music_play(false)">
        <span v-if="$store.state.music.status=='playing'" class="glyphicon glyphicon-pause"></span>
        <span v-else class="glyphicon glyphicon-play"></span>
      </button>
      <button class="btn btn-default btn-sm pull-right" v-on:click="music_next"><span class="glyphicon glyphicon-forward"></span></button>
      <label>ステータス</label> {{$store.state.music.status}} <label>再生モード</label> {{play_mode}}<br>
      <label>再生フォルダ</label> {{play_folder}} <label>ファイル名</label> {{this.$store.state.music.name}}
      <br>
    </span>
    <big>
    <button class="btn btn-default btn-sm" v-on:click="music_list_up()" v-if="folder_chain.length > 0">↑</button>
    /{{folder_chain.join('/')}}<br>
    <p>
      <button class="btn btn-primary" v-on:click="music_random_start(folder_chain.join('/'))">再生</button> <comp_focus focus_id="1" v-bind:current_focus_id="current_focus_id">このフォルダ</comp_focus>
    </p>
    <ul>
      <li v-for="(item, index) in music_dir_list">
        <button class="btn btn-default btn-sm" v-on:click="music_list_down(item)">↓</button> <comp_focus v-bind:focus_id="2 + index" v-bind:current_focus_id="current_focus_id">{{item}}</comp_focus>
      </li>
    </ul>
    <ul>
      <li v-for="(item, index) in music_item_list">
        <button class="btn btn-primary btn-sm" v-on:click="music_start(folder_chain.join('/'), item)">再生</button> <comp_focus v-bind:focus_id="2 + music_dir_list.length + index" v-bind:current_focus_id="current_focus_id">{{item}}</comp_focus>
      </li>
    </ul>
    </big>
    <button class="btn btn-default btn-lg pull-right" v-on:click="$store.commit('page_change')">閉じる</button>
    <br>
    <br>
  </div>
  `,
  data: function () {
    return {
      music_base: "",
      play_item: "",
      play_mode: "onetime",
      play_folder: "",
      play_counter: 0,
      play_index: -1,
      folder_chain: [],
      music_dir_list: {},
      music_item_list: {},
      current_focus_id: null,
    }
  },
  computed: {
  },
  methods: {
    //  リモコンキー受信した
    onIrKeyReceived: async function(key){
      var no = parseInt(this.current_focus_id || "1");
      switch(key){
        case 201:{ // ←
          if( this.$store.state.page != "music" )
            this.$store.commit('page_change', "music");
  
          await this.music_list_up();
          break;
        }
        case 202:{ // →
          if( this.$store.state.page != "music" )
            this.$store.commit('page_change', "music");
  
          if( no == 1 || (1 + this.music_dir_list.length) < no)
            return;          
          await this.music_list_down(this.music_dir_list[no - 2]);
          break;
        }
        case 203:{ // ↑
          if( this.$store.state.page != "music" )
            this.$store.commit('page_change', "music");
  
          no--;
          if( no < 1 )
            return;
          this.current_focus_id = String(no);
          break;
        }
        case 204:{ // ↓
          if( this.$store.state.page != "music" )
            this.$store.commit('page_change', "music");

          no++;
          if( (1 + this.music_dir_list.length + this.music_item_list.length) < no )
            return;
          this.current_focus_id = String(no);
          break;
        }
        case 205:{ // 〇
          if( this.$store.state.music.status == 'playing' || this.$store.state.music.status == 'pause' ){
            this.music_play(false);
            return;
          }
          if( no == 1 ){
            await this.music_random_start(this.folder_chain.join('/'));
          }else if( 1 < no && no <= (1 + this.music_dir_list.length)){
            await this.music_random_start(this.folder_chain.join('/') + this.music_dir_list[no - 1 - 1]);
          }else if( (1 + this.music_dir_list.length) < no && no <= (1 + this.music_dir_list.length + this.music_item_list.length) ){
            await this.music_start(this.folder_chain.join('/'), this.music_item_list[no - (1 + this.music_dir_list.length) - 1]);
          }
          break;
        }
        case 206:{ // >>
          this.music_next();
          break;
        }
        case 207:{ // ■
          this.music_stop();
          break;
        }
      }
    },

    // 音楽リスト表示の更新
    music_list_update: async function(){
      let result = await do_post(BASE_URL + "/csd-get-musicList", { folder: this.folder_chain.join('/') });
      console.log(result);
      this.music_dir_list = result.dirs;
      this.music_item_list = result.files;
      this.music_base = result.base;

      this.current_focus_id = "1";
    },

    // 音楽リストフォルダの移動(下位)
    music_list_down: async function(folder){
      this.folder_chain.push(folder);
      console.log(this.folder_chain);
      return this.music_list_update();
    },

    // 音楽リストフォルダの移動(上位)
    music_list_up: async function(){
      if( this.folder_chain.length <= 0 )
        return;
      this.folder_chain.pop();
      return this.music_list_update();
    },
    
    // 音楽ファイルのランダム再生
    music_random_start: async function(folder){
      this.play_mode = "random";
      this.play_folder = folder;
      let result = await do_post(BASE_URL + "/csd-get-randomMusic", { folder: this.play_folder });
      console.log(result);
      if( !result.item )
        return;
      this.$store.state.music.name = result.item;
      this.play_item = result.base + ((result.folder ? ("/" + result.folder) : "" )) + "/" + result.item;
      this.music_play();
      this.$store.commit('page_change');
    },

    // 音楽ファイルのワンタイム再生
    music_start: function(folder, item){
      this.play_mode = "ontime";
      this.play_folder = folder;
      this.$store.state.music.name = item;
      this.play_item = this.music_base + "/" + this.play_folder + '/' + item;
      this.music_play();
      this.$store.commit('page_change');
    },

    // 一時的に別音声ファイル再生
    music_insert: function(audio_url){
      try{
        let playing = false;
        if( this.media && this.$store.state.music.status == 'playing' ){
          this.media.pause();
          playing = true;
        }

        let media2 = new Media(audio_url,
          () =>{
            console.log('mediaplay finished');
            if( playing ){
              this.media.play();
            }
          },
          (err) =>{
            console.error('media load error: ', err);
            if( playing ){
              this.media.play();
            }
          }
        );
        media2.play();
      }catch(error){
        console.log(error);
      }
    },

    // 次の音楽ファイルの再生
    music_next: function(){
      if( this.$store.state.music.status && this.play_mode == "onetime")
          return;

      this.music_stop();
      this.$store.state.music.status = "pause";
      do_post(BASE_URL + "/csd-get-randomMusic", { folder: this.play_folder })
      .then( result =>{
        console.log(result);
        this.$store.state.music.name = result.item;
        this.play_item = result.base + ((result.folder ? ("/" + result.folder) : "" )) + "/" + result.item;
        this.music_play();
      });
    },

    // 音楽ファイル再生の停止
    music_stop: function(){
      if( !this.$store.state.music.status || !this.media )
        return;

      console.log("media stop/release");
      this.play_counter++;
      this.media.release();
      this.media = undefined;
      this.$store.state.music.status = null;
    },

    // 音楽ファイルの再生
    music_play: function(restart = true){
      console.log("music_play:" + this.play_item + " " + restart);
      if( restart )
        this.music_stop();
  
      if( !this.media ){
        console.log("media create");
        const counter = this.play_counter;
        this.media = new Media(this.play_item, () =>{
          console.log('mediaplay finished');
          if( this.play_counter == counter ){
            if( this.play_mode == "random" ){
              this.music_next();
            }else{
              this.music_stop();
            }
          }
        }, (err) =>{
            console.error('media load error: ', err);
        });
      }
      
      if( !this.$store.state.music.status || this.$store.state.music.status == "pause" ){
        this.media.play();
        this.$store.state.music.status = "playing";
      }else if( this.$store.state.music.status == "playing" ){
        this.media.pause();
        this.$store.state.music.status = "pause";
      }
    },
    
    // ページが選択された
    onSelected: async function(){
      if( this.$store.state.music.status ){
        if( !this.play_folder )
          this.folder_chain = [];
        else
          this.folder_chain = this.play_folder.split('/');
      }
      await this.music_list_update();
    }
  },
  mounted: function(){
    console.log('music mounted');
  }
}
