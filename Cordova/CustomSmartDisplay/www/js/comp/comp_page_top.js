'use strict';

const UDP_LOCAL_PORT = 20001; // UDP受信待ち受けポート番号
const CLOCK_UPDATE_INTERVAL = 10000; // 日時表示の更新頻度(msec)
const BRIGHTNESS_UPDATE_INTERVAL = 10000; // 照度の取得頻度(msec)
const BGIMAGE_UPDATE_INTERVAL = 120000; // 背景画像の更新頻度(msec)
const BRIGHTNESS_THRESHOLD = 2.0; // ダーク表示にする照度の閾値
const VOLUME_STEP = 0.1; // 音量の上げ下げのステップ量(0.0～1.0)
const TOAST_TIMEUP = 12 * 60 * 60 * 1000; // トーストの表示期間(msec)

const comp_top = {
  props: ['value'],
  mixins: [mixins_bootstrap],
  store: vue_store,
  template: `
  <div>
    <div class="top-popup container-fluid" style="padding: 15px" v-if="$store.state.music.status">
      <button class="btn btn-default btn-sm pull-right" v-on:click="music_stop"><span class="glyphicon glyphicon-stop"></span></button>
      <button class="btn btn-default btn-sm pull-right" v-on:click="music_play(false)">
        <span v-if="$store.state.music.status=='playing'" class="glyphicon glyphicon-pause"></span>
        <span v-else class="glyphicon glyphicon-play"></span>
      </button>
      <button class="btn btn-default btn-sm pull-right" v-on:click="music_next"><span class="glyphicon glyphicon-forward"></span></button>
      <font size="4" class="pull-right">{{$store.state.music.name}}&nbsp;&nbsp;</font>
    </div>

    <div v-bind:class="{ 'top-text-leftbottom': !$store.state.is_dark, 'top-text-center': $store.state.is_dark }" v-on:click="panel_touch">
      <font color="white">
        <span style="font-size: 150px;">{{toTimeString(datetime_now)}}</span><br>
        <span style="font-size: 50px;">{{toDateString(datetime_now)}}</span><br>
      </font>
    </div>

    <div class="modal fade" id="page_select_dialog">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <button class="btn btn-default pull-right" v-on:click="dialog_close('#page_select_dialog')">閉じる</button>
            <h3 class="modal-title">ページの選択</h3>
          </div>
          <div class="modal-body">
            <br>
            <button class="btn btn-primary btn-lg" v-on:click="page_change('music')">音楽</button>
            <button class="btn btn-primary btn-lg" v-on:click="page_change('hello')">Hello</button>
            <button class="btn btn-primary btn-lg" v-on:click="page_change('board')">掲示板</button>
            <br><br>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default pull-left" v-on:click="page_change('config')"><span class="glyphicon glyphicon-cog"></span></button>
            <div v-if="$store.state.config.debug" class="pull-left">
              <button class="btn btn-default btn-sm" v-on:click="page_reload">reload</button>
            </div>
            <label>音量</label>
            <button class="btn btn-default btn-lg" v-on:click="volume_up">▲</button>
            <span v-if="volume >= 0.0">{{volume.toFixed(2)}}</span>
            <button class="btn btn-default btn-lg" v-on:click="volume_down">▼</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  data: function () {
    return {
      datetime_now: new Date().getTime(), // 現在日時
      volume: -1, // 現在の音量
    }
  },
  methods: {
    // 音量を上げる
    volume_up: function(){
      console.log("volume up");
      cordova.plugins.VolumeControl.getVolume(volume =>{
        volume = parseFloat(volume);
        if( volume >= 1.0 - VOLUME_STEP )
          volume = 1.0;
        else
          volume += VOLUME_STEP;
        cordova.plugins.VolumeControl.setVolume(volume);
        this.volume = volume;
      });
    },

    // 音量を下げる
    volume_down: function(){
      console.log("volume down");
      cordova.plugins.VolumeControl.getVolume(volume =>{
        volume = parseFloat(volume);
        if( volume <= VOLUME_STEP )
          volume = 0.0;
        else
          volume -= VOLUME_STEP;
        cordova.plugins.VolumeControl.setVolume(volume);
        this.volume = volume;
      });
    },

    // Webページをリロードする(デバッグ用)
    page_reload: async function(){
      location.reload();
    },

    // タッチパネルをタッチされた(音量取得＋ページ選択ダイアログ表示)
    panel_touch: function(){
      if( this.$store.state.display.is_dark ){
        this.background_change_dark(false);
        return;
      }
      cordova.plugins.VolumeControl.getVolume(volume =>{
        this.volume = parseFloat(volume);
      });
      this.dialog_open('#page_select_dialog', true);
    },

    // ページを変更
    page_change: function(page){
      this.$store.commit('page_change', page );
      this.dialog_close('#page_select_dialog');
    },

    // 音楽再生を開始
    music_play: async function(restart = false){
      page_refs.page_music.music_play(restart);
    },

    // 音楽再生を停止
    music_stop: async function(){
      page_refs.page_music.music_stop();
    },

    // 次の音楽を再生
    music_next: async function(){
      page_refs.page_music.music_next();
    },

    // 日付表示文字列に変換
    toDateString: function(tim){
      const d = new Date(tim);
      const weekStr = ["日", "月", "火", "水", "木", "金", "土"];
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekStr[d.getDay()]})`; 
    },

    // 時間表示文字列に変換
    toTimeString: function(tim){
      const to2d = (d) => {
        return ("00" + d).slice(-2);
      };
      const d = new Date(tim);
      return `${to2d(d.getHours())}:${to2d(d.getMinutes())}`; 
    },

    //  リモコンキー受信した
    onIrKeyReceived: async function(key){
      switch(key){
        case 11:{
          this.volume_up();
          break;
        }
        case 12:{
          this.volume_down();
          break;
        }
        default:{
          console.log("unknown key: " + key);
          break;
        }
      }
    },
  },
  mounted: function(){
    console.log('top mounted');

    // 定期的に日時を更新
    setInterval(() =>{
      this.datetime_now = new Date().getTime();
    }, CLOCK_UPDATE_INTERVAL);
  }
}
