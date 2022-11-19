'use strict';

const THIS_BASE_PATH = process.env.THIS_BASE_PATH;
const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';

const KINESIS_REGION = "kinesalite";
const KINESIS_ENDPOINT = process.env.ROUTING_KINESIS_ENDPOINT;

const KINESIS_TARGET_FNAME = "kinesis.json";
const DEFAULT_HANDLER = "handler";
const DEFAULT_INTERVAL = 1000;

const AWS = require('aws-sdk');
const kinesis = new AWS.Kinesis({
	region: KINESIS_REGION,
	endpoint: KINESIS_ENDPOINT
});

const fs = require('fs');

function parse_kinesis() {
  // kinesis.jsonの検索
  const folders = fs.readdirSync(CONTROLLERS_BASE);
  folders.forEach(folder => {
    try {
      const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
      if (!stats_dir.isDirectory())
        return;
    
      const fname = CONTROLLERS_BASE + folder + "/" + KINESIS_TARGET_FNAME;
      if (!fs.existsSync(fname))
        return;
      const stats_file = fs.statSync(fname);
      if (!stats_file.isFile())
        return;

      // consumerの登録
      const defs = JSON.parse(fs.readFileSync(fname).toString());
      parse_kinesis_json(defs, CONTROLLERS_BASE + folder, folder);
    } catch (error) {
      console.error(error);
    }
  });
}

async function parse_kinesis_json(defs, folder, folder_name) {
  defs.forEach(item => {
    if (!item.enable )
      return;
      
    const handler = item.handler || DEFAULT_HANDLER;
    const proc = require(folder)[handler];
    const intervalSec = item.IntervalSec || DEFAULT_INTERVAL;

    waitForCreateAndActive(item.StreamName)
    .then( result =>{
      consumLoop(item.StreamName, intervalSec, proc);

      console.log("kinesis(" + item.StreamName + ") " + handler + ' ' + folder_name);
    });
  });
}

async function wait_async(msec){
  return new Promise(resolve => setTimeout(resolve, msec));
}

async function getRecordsAll(params){
  const result = await kinesis.getShardIterator(params).promise();
  const shardIterator = result.ShardIterator;
  
  let list = [];
  while (true) {
    let getRecParams = {
        ShardIterator: shardIterator
    };
    let result = await kinesis.getRecords(getRecParams).promise();

    list.push(...result.Records);
    if( result.MillisBehindLatest == 0 )
      break;
    if( !result.NextShardIterator )
      break;
    getRecParams.shardIterator = result.NextShardIterator;
  }

  return list;
}

async function consumLoop(streamName, intervalSec, func){
  const result = await kinesis.describeStream( { StreamName: streamName } ).promise();
  const shardId = result.StreamDescription.Shards[0].ShardId;
  let startSequenceNumber;
        
  const getParams = {
    ShardId: shardId,
    ShardIteratorType: "TRIM_HORIZON",
    StreamName: streamName,
  };
  const list = await getRecordsAll(getParams);
  if( list.length > 0 )
    startSequenceNumber = list[list.length - 1].SequenceNumber;

  while(true){
    let params = {
      ShardId: shardId,
      StreamName: streamName,
    };
    if( startSequenceNumber ){
      params.ShardIteratorType = "AFTER_SEQUENCE_NUMBER";
      params.StartingSequenceNumber = startSequenceNumber;
    }else{
      params.ShardIteratorType = "TRIM_HORIZON";
    }
    
    const records = await getRecordsAll(params);
    let event = {
      Records: []
    };
    for( let record of records ){
      let item = {
        kinesis: {
          kinesisSchemaVersion: "1.0",
          partitionKey: record.PartitionKey,
          sequenceNumber: record.SequenceNumber,
          data: record.Data.toString('base64'),
          approximateArrivalTimestamp: new Date(record.ApproximateArrivalTimestamp).getTime() / 1000,
        },
        eventSource: "aws:kinesis",
        eventVersion: "1.0",
        eventId: shardId + ":" + record.SequenceNumber,
        eventName: "aws:kinesis:record",
        awsRegion: KINESIS_REGION,
      }
      event.Records.push(item);
    }

    if( records.length > 0 ){
      startSequenceNumber = records[records.length - 1].SequenceNumber;
      func( event, {});
    }else{
      await wait_async(intervalSec);
    }
  }
}

async function waitForCreateAndActive(streamName){
  return new Promise(async (resolve, reject) => {
    try{
      let result = await kinesis.describeStreamSummary( { StreamName: streamName } ).promise();
      resolve(result);
    }catch(error){
      try{
        let params = {
          StreamName: streamName,
          ShardCount: 1,
          StreamModeDetails: {
            StreamMode: "PROVISIONED"
          },
        };
        let result = await kinesis.createStream( params ).promise();
        console.log("steamName:" + steamName + " creating");

        kinesis.waitFor('streamExists', { StreamName: streamName }, async (err, data) =>{
          if (err)
            return reject(err);

          do{
            let result = await kinesis.describeStreamSummary( { StreamName: streamName } ).promise();
            if( result.StreamDescriptionSummary.StreamStatus == "ACTIVE" )
              return resolve(result);

            await wait_async(2000);
          }while(true);
        });
      }catch(error){
        return reject(error);
      }
    }
  });
}

module.exports = parse_kinesis();
