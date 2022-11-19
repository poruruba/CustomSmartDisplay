class SampleUdp{
	constructor(){
	}

	initialize(localRecvPort){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result);
				},
				function(err){
					reject(err);
				},
				"SampleUdp", "initialize",
				[localRecvPort]);
		});
	}

	receive(){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result);
				},
				function(err){
					reject(err);
				},
				"SampleUdp", "receive",
				[]);
		});
	}

	send(message, host, port){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result);
				},
				function(err){
					reject(err);
				},
				"SampleUdp", "send",
				[message, host, port]);
		});
	}

	registerReceiveListener(callback){
		if( !this.receiveCallback ){
			this.receiveCallback = callback;
			new Promise(async (resolve, reject) =>{
				try{
					while(this.receiveCallback){
						let result = await this.receive();
						new Promise(resolve =>{
							try{
								if( this.receiveCallback )
									this.receiveCallback(result);
							}finally{
								resolve();
							}
						});
					}
					resolve();
				}catch(err){
					reject(err);
				}
			});
		}else{
			this.receiveCallback = callback;
		}
	}

	unregisterReceiveListener(){
		this.receiving = false;
		this.receiveCallback = null;
	}
}

module.exports = new SampleUdp();
