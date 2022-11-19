'use strict';

const THIS_BASE_PATH = process.env.THIS_BASE_PATH;

const HELPER_BASE = process.env.HELPER_BASE || "/opt/";
const Response = require(HELPER_BASE + 'response');
const TextResponse = require(HELPER_BASE + 'textresponse');

const DEFAULT_HANDLER = "handler";

const swagger_utils = require(HELPER_BASE + 'swagger_utils');
const fs = require('fs');

const SWAGGER_DEFAULT_BASE = THIS_BASE_PATH + '/api/swagger/';
const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';
const BACKEND_BASE = THIS_BASE_PATH + '/amplify/backend/function/';
const CRON_TARGET_FNAME = "cron.json";
const MQTT_TARGET_FNAME = "mqtt.json";
const SQS_TARGET_FNAME = "sqs.json";
const UDP_TARGET_FNAME = "udp.json";
const SWAGGER_TARGET_FNAME = "swagger.yaml";

exports.handler = async (event, context, callback) => {
  if( event.path == '/swagger'){
    const root_file = fs.readFileSync(SWAGGER_DEFAULT_BASE + SWAGGER_TARGET_FNAME, 'utf-8');
    const root = swagger_utils.parse_document(root_file);

    root.contents.set("host", event.headers.host);
//    root.contents.set("basePath", event.stage);

    swagger_utils.delete_paths(root);
    swagger_utils.delete_definitions(root);

    const folders = fs.readdirSync(CONTROLLERS_BASE);
    folders.forEach(folder => {
      try {
        const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
        if (!stats_dir.isDirectory())
          return;
        const stats_file = fs.statSync(CONTROLLERS_BASE + folder + '/' + SWAGGER_TARGET_FNAME);
        if (!stats_file.isFile())
          return;
      } catch (error) {
        return;
      }

      const file = fs.readFileSync(CONTROLLERS_BASE + folder + '/' + SWAGGER_TARGET_FNAME, 'utf-8');
      const doc = swagger_utils.parse_document(file);

      swagger_utils.append_paths(root, doc, folder);
      swagger_utils.append_definitions(root, doc, folder);
    });

    if( fs.existsSync(BACKEND_BASE) ){
      const stats_folder2 = fs.statSync(BACKEND_BASE);
      if( !stats_folder2.isDirectory() ){
        const folders2 = fs.readdirSync(BACKEND_BASE);
        folders2.forEach(folder => {
          try {
            const stats_dir = fs.statSync(BACKEND_BASE + folder);
            if (!stats_dir.isDirectory())
              return;
            const stats_file = fs.statSync(BACKEND_BASE + folder + '/src/' + SWAGGER_TARGET_FNAME);
            if (!stats_file.isFile())
              return;
          } catch (error) {
            return;
          }

          const file = fs.readFileSync(BACKEND_BASE + folder + '/src/' + SWAGGER_TARGET_FNAME, 'utf-8');
          const doc = swagger_utils.parse_document(file);

          swagger_utils.append_paths(root, doc, folder);
          swagger_utils.append_definitions(root, doc, folder);
        });
      }
    }

    return new Response(root);
  }else
  if( event.path == '/endpoints' ){
    let endpoints = {
      cron: [],
      mqtt: [],
      sqs: [],
      udp: [],
    };

    const folders = fs.readdirSync(CONTROLLERS_BASE);
    folders.forEach(folder => {
      try {
        const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
        if (!stats_dir.isDirectory())
          return;

        let fname;
        let root;
        
        root = endpoints.cron;
        fname = CONTROLLERS_BASE + folder + "/" + CRON_TARGET_FNAME;
        if (fs.existsSync(fname)){
          const stats_file = fs.statSync(fname);
          if (stats_file.isFile()){
            const defs = JSON.parse(fs.readFileSync(fname).toString());
            for(let def of defs){
              const item = {
                operationId: folder,
                schedule: def.schedule,
                handler: def.handler ? def.handler : DEFAULT_HANDLER,
                enable: def.enable ? true : false
              };
              root.push(item);
            }
          }
        }

        root = endpoints.sqs;
        fname = CONTROLLERS_BASE + folder + "/" + SQS_TARGET_FNAME;
        if (fs.existsSync(fname)){
          const stats_file = fs.statSync(fname);
          if (stats_file.isFile()){
            const defs = JSON.parse(fs.readFileSync(fname).toString());
            for(let def of defs){
              const item = {
                operationId: folder,
                QueueUrl: def.QueueUrl,
                handler: def.handler ? def.handler : DEFAULT_HANDLER,
                enable: def.enable ? true : false
              };
              root.push(item);
            }
          }
        }

        root = endpoints.udp;
        fname = CONTROLLERS_BASE + folder + "/" + UDP_TARGET_FNAME;
        if (fs.existsSync(fname)){
          const stats_file = fs.statSync(fname);
          if (stats_file.isFile()){
            const defs = JSON.parse(fs.readFileSync(fname).toString());
            for(let def of defs){
              const item = {
                operationId: folder,
                port: def.port,
                handler: def.handler ? def.handler : DEFAULT_HANDLER,
                enable: def.enable ? true : false
              };
              root.push(item);
            }
          }
        }

      } catch (error) {
        console.log(error);
      }
    });

    return new Response(endpoints);
  }
}
