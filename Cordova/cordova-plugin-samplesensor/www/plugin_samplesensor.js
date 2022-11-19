class SampleSensor{
	constructor(){
	}

	addDevice(deviceName){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result);
				},
				function(err){
					reject(err);
				},
				"SampleSensor", "addDevice",
				[deviceName]);
		});
	}

	removeDevice(devicename){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result);
				},
				function(err){
					reject(err);
				},
				"SampleSensor", "removeDevice",
				[deviceName]);
		});
	}

	getValue(deviceName){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result.value);
				},
				function(err){
					reject(err);
				},
				"SampleSensor", "getValue",
				[deviceName]);
		});
	}

	getSupportedDevices(){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result.list);
				},
				function(err){
					reject(err);
				},
				"SampleSensor", "getSupportedDevices",
				[]);
		});
	}

}

module.exports = new SampleSensor();
