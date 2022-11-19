'use strict';

//const vConsole = new VConsole();
//const remoteConsole = new RemoteConsole("http://[remote server]/logio-post");
//window.datgui = new dat.GUI();

var page_refs;

var vue_options = {
  el: "#top",
  mixins: [mixins_bootstrap],
  store: vue_store,
  data: {
    is_dark_prev: false, // ひとつ前がダーク表示だったか
  },
  computed: {
  },
  methods: {

    // 背景画像のランダム変更と背景表示変更
    background_change: async function(){
      console.log("background_change called");
      let result = await do_post(BASE_URL + "/csd-get-randomImage");
      console.log(result);
      this.$store.state.display.bg_url = result.base + "/" + result.item;
      this.$store.commit("background_update");
    },

    // 背景ダーク表示の設定と背景表示変更
    background_change_dark: function(is_dark_now){
      if( (this.$store.state.display.is_dark == is_dark_now) || (is_dark_now && !this.is_dark_prev)){
        this.is_dark_prev = is_dark_now;
        return;
      }

      this.is_dark_perv = is_dark_now;
      this.$store.state.display.is_dark = is_dark_now;
      this.$store.commit("background_update");
    },

    // UDPパケットを受信した
    onUdpReceived: async function(data){
      console.log("udp received: ", data);

      const payload = JSON.parse(data.payload);
      if( payload.type == "board_add"){
        if( this.$store.state.page == 'board' )
          page_refs['page_board'].board_update();
      }else
      if( payload.type == "ir_receive" ){
        if( this.$store.state.display.page == 'config' ){
          page_refs["page_config"].onIrReceived(payload);
        }else{
          var decode_type = payload.decode_type;
          var address = payload.address;
          var command = payload.command;
  
          var item = this.$store.state.config.remocon.codelist.find(item => item.ircode.decode_type == decode_type && item.ircode.address == address && item.ircode.command == command );
          if( item ){
            if( item.key ){
              switch( Math.floor(item.key / 100) ){
                case 1: { // key=1xx
                  await page_refs.page_top.onIrKeyReceived(item.key);
                  break;
                }
                case 2: { // key=2xx
                  await page_refs.page_music.onIrKeyReceived(item.key);
                  break;
                }
                default: {
                  console.log("unknown key: " + key);
                  break;
                }
              }
            }else
            if( item.slot ){
              const slot = this.$store.state.config.remocon.slots.find(item2 => item2.key == item.slot );
              if( slot ){
                const params = {
                  host: this.$store.state.config.remocon.ipaddress,
                  rawbuf: slot.ircode.rawbuf
                };
                let result = await do_post(BASE_URL + "/csd-send-ir", params);
                console.log(result);
              }
            }
          }else{
            console.log("unknown ircode");
          }
        }
      }
    },

    // Cordova初期化処理が完了した
    onDeviceReady: async function(){
      console.log('start.js onDeviceReady called');

      // 画面常時On
      window.powermanagement.acquire();

      // IPアドレス取得
      const ip = await new Promise((resolve, reject) =>{
        networkinterface.getWiFiIPAddress(resolve, reject);
      });
      console.log(ip);
      this.$store.state.ipaddress = ip.ip;

      // 設定ページの初期化
      await page_refs["page_config"].onDeviceReady();

      // 照度取得開始
      const light_type = "android.sensor.light";
      samplesensor.addDevice(light_type);

      // 定期的に照度を取得し、背景表示変更
      setInterval(async () =>{
        const values = await samplesensor.getValue(light_type);
        this.background_change_dark(values[0] < BRIGHTNESS_THRESHOLD);
      }, BRIGHTNESS_UPDATE_INTERVAL);

      // UDPパケット受信開始
      sampleudp.initialize(UDP_LOCAL_PORT);
      sampleudp.registerReceiveListener(this.onUdpReceived);
      console.log("SampleUdp initialized");
    }

  },
  created: function(){
  },
  mounted: async function(){
    proc_load();

    console.log("start.js mounted");

    let list = {};
    for( let item in this.$refs )
      if( item.startsWith('page_') )
        list[item] = this.$refs[item];

    page_refs = list;

    this.$store.state.uuid = localStorage.getItem("uuid");
    if( !this.$store.state.uuid ){
      this.$store.state.uuid = UUID.generate();
      localStorage.setItem("uuid", this.$store.state.uuid);
    }
    console.log("uuid=" + this.$store.state.uuid);

    // 定期的に背景画像を変更
    await this.background_change();
    setInterval(async () =>{
      await this.background_change();
    }, BGIMAGE_UPDATE_INTERVAL);
  }
};
vue_add_data(vue_options, { progress_title: '' }); // for progress-dialog
vue_add_global_components(components_bootstrap);
vue_add_global_components(components_utils);

/* add additional components */
vue_add_global_component("comp_focus", comp_focus);
vue_add_global_component("comp_top", comp_top);
vue_add_global_component("comp_music", comp_music);
vue_add_global_component("comp_config", comp_config);
vue_add_global_component("comp_hello", comp_hello);
vue_add_global_component("comp_board", comp_board);
  
window.vue = new Vue( vue_options );
