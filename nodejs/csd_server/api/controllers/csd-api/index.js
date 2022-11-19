'use strict';

const CONTENTS_BASE_URL = "http://【Node.jsサーバのホスト名】:20080/csd-contents";

const HELPER_BASE = process.env.HELPER_BASE || '../../helpers/';
const Response = require(HELPER_BASE + 'response');
const jsonfile = require(HELPER_BASE + 'jsonfile-utils');

const IMAGE_BASE = "gallery";
const MUSIC_BASE = "music";
const CONFIG_FILE_PATH = process.env.THIS_BASE_PATH + '/data/csd/config.json';
const REMOCON_FILE_PATH = process.env.THIS_BASE_PATH + '/data/csd/remocon.json';

const IMAGE_PATH = process.env.THIS_BASE_PATH + '/public/csd-contents/' + IMAGE_BASE;
const MUSIC_PATH = process.env.THIS_BASE_PATH + '/public/csd-contents/' + MUSIC_BASE;

const CSD_UDP_PORT = 20001;
const REMOCON_UDP_PORT = 20001;

const fs = require('fs').promises;
const path = require('path');

const dgram = require('dgram');
const udpSocket = dgram.createSocket('udp4');

const sqlite3 = require("sqlite3");
const BOARD_FILE_PATH = process.env.THIS_BASE_PATH + '/data/csd/board.db';
const db = new sqlite3.Database(BOARD_FILE_PATH);
const BOARD_TABLE_NAME = "board";

db.each("SELECT COUNT(*) FROM sqlite_master WHERE TYPE='table' AND name='" + BOARD_TABLE_NAME + "'", (err, row) =>{
  if( err ){
    console.error(err);
    return;
  }
  if( row["COUNT(*)"] == 0 ){
    db.run("CREATE TABLE '" + BOARD_TABLE_NAME + "' (id INTEGER PRIMARY KEY AUTOINCREMENT, who_from, who_to, message, uuid, received_at)", (err, row) =>{
      if( err ){
        console.error(err);
        return;
      }
    });
  }
});

exports.udp_handler = async (event, context) => {
  console.log(event);
  var body = JSON.parse(event.body);

  const json = await jsonfile.read_json(REMOCON_FILE_PATH, []);
  let item = json.find(item => item.ipaddress == event.remote.address );
  if( !item ){
    item = {
      ipaddress: event.remote.address,
      received_at: new Date().getTime()
    };
    json.push(item);
  }else{
    item.received_at = new Date().getTime();
  }
  await jsonfile.write_json(REMOCON_FILE_PATH, json);

  const client_json = await jsonfile.read_json(CONFIG_FILE_PATH, { list: [] });
  const client_list = client_json.list.filter(item => item.config.remocon && item.config.remocon.ipaddress == event.remote.address);
  for( let client of client_list ){
    context.udp.send(JSON.stringify(body), CSD_UDP_PORT, client.ipaddress);
    console.log("udp sended");
  }
};

exports.handler = async (event, context, callback) => {
  const body = JSON.parse(event.body);
  console.log(body);

  if( event.path == '/csd-get-board' ){
    var now = new Date();
    now.setDate(now.getDate() - 14);
    var start = now.getTime();
    return new Promise((resolve, reject) =>{
      db.all("SELECT * FROM '" + BOARD_TABLE_NAME + "' WHERE received_at >= ? ORDER BY received_at DESC", [start], (err, rows) => {
        if( err )
          return reject(err);
        resolve(new Response({ rows: rows }));
      });
    });
  }else

  if( event.path == '/csd-add-board' ){
    const uuid = body.uuid;
    const now = new Date().getTime();
    const message = body.message;
    const from = body.from;
    const to = body.to;

    await new Promise((resolve, reject) =>{
      db.run("INSERT INTO '" + BOARD_TABLE_NAME + "' (message, who_from, who_to, uuid, received_at) VALUES (?, ?, ?, ?, ?)", [message, from, to, uuid, now], (err) =>{
        if( err )
          return reject(err);
        resolve(new Response({}));
      });
    });

    const payload = {
      type: 'board_add',
    };
    const json = await jsonfile.read_json(CONFIG_FILE_PATH, { list: [] });
    for( const client of json.list){
      if( client.uuid == uuid )
        continue;
      await pushUdpMessage(payload, client.ipaddress, CSD_UDP_PORT);
    }
    return new Response({});
  }else

  if( event.path == '/csd-send-ir' ){
    const payload = {
      type: "ir_send",
      rawbuf: body.rawbuf
    };
    await pushUdpMessage(payload, body.host, REMOCON_UDP_PORT);
    return new Response({});
  }else

  if( event.path == '/csd-get-remoconlist' ){
    const json = await jsonfile.read_json(REMOCON_FILE_PATH, []);
    return new Response({ list: json });
  }else

  if( event.path == '/csd-get-config' ){
    let json = await jsonfile.read_json(CONFIG_FILE_PATH, { list: [] });
    let item = json.list.find(item => item.uuid == body.uuid );
    if( !item )
      throw new Error("uuid not found");
    if( body.ipaddress && body.ipaddress != item.ipaddress ){
      item.ipaddress = body.ipaddress;
      await jsonfile.write_json(CONFIG_FILE_PATH, json);
    }
    return new Response({config: item.config});
  }else

  if( event.path == '/csd-set-config' ){
    let json = await jsonfile.read_json(CONFIG_FILE_PATH, { list: [] });
    const index = json.list.findIndex(item => item.uuid == body.uuid );
    let item = {
      uuid: body.uuid,
      ipaddress: body.ipaddress,
      config: body.config
    };
    if( index < 0 )
      json.list.push(item);
    else
      json.list[index] = item;
    await jsonfile.write_json(CONFIG_FILE_PATH, json);

    return new Response({});
  }else

  if( event.path == '/csd-get-randomImage' ){
    let base = IMAGE_PATH;
    if( body.folder )
      base += "/" + body.folder;
    base = path.normalize(base);
    if( !base.startsWith(path.normalize(IMAGE_PATH)) )
      throw "invalid base";

    const files = await scanFiles(base, "", [".jpg", ".png"], 1);
    const item = randomItem(files);

    return new Response({ base: CONTENTS_BASE_URL + "/" + IMAGE_BASE, folder: body.folder, item: item });
  }else

  if( event.path == '/csd-get-randomMusic' ){
    let base = MUSIC_PATH;
    if( body.folder )
      base += "/" + body.folder;
    base = path.normalize(base);
    if( !base.startsWith(path.normalize(MUSIC_PATH)) )
      throw "invalid base";

    const files = await scanFiles(base, "", [".flac", ".mp3"], 2);
    const item = randomItem(files);

    return new Response({ base: CONTENTS_BASE_URL + "/" + MUSIC_BASE, folder: body.folder, item: item });
  }else

  if( event.path == '/csd-get-musicList' ){
    let base = MUSIC_PATH;
    if( body.folder )
      base += "/" + body.folder;
    base = path.normalize(base);
    if( !base.startsWith(path.normalize(MUSIC_PATH)) )
      throw "invalid base";

    const files = await scanFiles(base, "", [".flac", ".mp3"], 0);
    const dirs = await scanDirs(base, "");

    return new Response({ base: CONTENTS_BASE_URL + "/" + MUSIC_BASE, folder: body.folder, files: files, dirs: dirs });
  }else
  {
    throw "unknown endpoint: " + event.path;
  }
};

async function scanFiles(base, folder, exts, depth){
  let list = [];
  const files = await fs.readdir(base + "/" + folder);
  for( let file of files ){
    const ffile = folder ? (folder + "/" + file) : file;
    const fstat = await fs.stat(base + "/" + ffile);
    if( fstat.isDirectory() ){
      if( depth > 0 ){
        const sublist = await scanFiles(base, ffile, exts, depth - 1);
        list.push(...sublist);
      }
    }else if( fstat.isFile() ){
      const fext = path.extname(file);
      if( exts.indexOf(fext) >= 0 )
        list.push(ffile);
    }
  }

  return list;
}

async function scanDirs(base, folder){
  let list = [];
  const files = await fs.readdir(base + "/" + folder);
  for( let file of files ){
    const ffile = folder ? (folder + "/" + file) : file;
    const fstat = await fs.stat(base + "/" + ffile);
    if( fstat.isDirectory() )
      list.push(ffile);
  }

  return list;
}

function randomItem(arry){
  if( arry.length <= 0 )
    return null;
  let index = Math.floor(Math.random() * arry.length);
  return arry[index];
}

async function pushUdpMessage(payload, host, port){
  return new Promise((resolve, reject) => {
    udpSocket.send(JSON.stringify(payload), port, host, (err, bytes) => {
      if (err) 
        return reject(err);
      console.log(bytes);
      resolve(bytes);
    });
  });
}