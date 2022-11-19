'use strict';

const BASE_URL = "http://【Node.jsサーバのホスト名】:20080";

const vue_store = new Vuex.Store({
  state: {
    config: {
      debug: true,
      remocon: {
        codelist: [],
        slots: []
      },
      displayName_list: [],
    },

    uuid: null,
    ipaddress: null,
    
    display: {
      page: null,
      bg_style: {},
      bg_url: "",
      is_dark: false,
    },

    music: {
      status: null,
      name: "",
    },

    displayName_list: [],
  },
  mutations: {
    page_change(state, page) {
      if( !page ){
        state.display.bg_style["background-color"] = "#ffffff00";
        state.display.page = null;
        if(page_refs["page_top"].onSelected )
          page_refs["page_top"].onSelected();
      }else{
        state.display.bg_style["background-color"] = "#ffffff88";
        state.display.page = page;
        if(page_refs["page_" + page].onSelected )
          page_refs["page_" + page].onSelected();
      }
    },
    background_update(state){
      if( !state.display.is_dark ){
        document.body.style.backgroundImage = 'url(' + state.display.bg_url + ')';
      }else{
        document.body.style.backgroundImage = "none";
      }
    },
  }
});