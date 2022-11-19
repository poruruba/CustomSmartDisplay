package jp.or.sample.plugin.SampleUdp;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaWebView;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;

public class Main extends CordovaPlugin {
	public static String TAG = "SampleUdp.Main";
	private Activity activity;

	private DatagramSocket udpReceive;
	private static final int DEFAULT_RECEIVE_BUFFER_SIZE = 1024;
	
	@Override
	public void initialize(CordovaInterface cordova, CordovaWebView webView)
	{
		Log.d(TAG, "[Plugin] initialize called");
		super.initialize(cordova, webView);

		activity = cordova.getActivity();
	}

	@Override
	public void onResume(boolean multitasking)
	{
		Log.d(TAG, "[Plugin] onResume called");
		super.onResume(multitasking);
	}

	@Override
	public void onPause(boolean multitasking)
	{
		Log.d(TAG, "[Plugin] onPause called");
		super.onPause(multitasking);
	}

	@Override
	public void onNewIntent(Intent intent)
	{
		Log.d(TAG, "[Plugin] onNewIntent called");
		super.onNewIntent(intent);
	}

	@Override
	public boolean execute(String action, JSONArray args, final CallbackContext callbackContext) throws JSONException
	{
		Log.d(TAG, "[Plugin] execute called");
		if( action.equals("initialize") ){
			try {
				int localRecvPort = args.getInt(0);
				if( udpReceive != null )
					udpReceive.close();
				udpReceive = new DatagramSocket(localRecvPort);
			}catch(Exception ex){
				Log.d(TAG, ex.getMessage());
				callbackContext.error("Invalid arg0(int)");
				return false;
			}
			callbackContext.success();
		}else
		if( action.equals("receive") ){
			int buflen = DEFAULT_RECEIVE_BUFFER_SIZE;
			try{
				if( args.length() > 0 )
					buflen = args.getInt(0);
			}catch(Exception ex){}

			final int finalbuflen = buflen;
			cordova.getThreadPool().execute(new Runnable() {
				@Override
				public void run() {
					try {
						byte[] buff = new byte[finalbuflen];
						DatagramPacket packet = new DatagramPacket(buff, buff.length);
						udpReceive.setSoTimeout(0);
						udpReceive.receive(packet);
						Log.d(TAG, "received");
						
						JSONObject result = new JSONObject();
						int len = packet.getLength();
						String payload = new String(buff, 0, len);
						result.put("payload", payload);
						byte[] address = packet.getAddress().getAddress();
						result.put("ipaddress", (((long)(address[0] & 0x00ff)) << 24) | (((long)(address[1] & 0x00ff)) << 16) | (((long)(address[2] & 0x00ff)) << 8) | (((long)(address[3] & 0x00ff)) << 0) );
						result.put("port", packet.getPort());
						callbackContext.success(result);
					} catch (Exception ex) {
						callbackContext.error(ex.getMessage());
					}
				}
			});
		}else
		if( action.equals("send") ){
			try{
				String message = args.getString(0);
				String host = args.getString(1);
				int port = args.getInt(2);

				cordova.getThreadPool().execute(new Runnable() {
					@Override
					public void run() {
						try {
							DatagramSocket udpSend = new DatagramSocket();
							byte[] buff = message.getBytes();
							InetAddress inetAddress = InetAddress.getByName(host);
							DatagramPacket packet = new DatagramPacket(buff, buff.length, inetAddress, port);
							udpSend.send(packet);
							Log.d(TAG, "sended");
							udpSend.close();
							
							callbackContext.success();
						} catch (Exception ex) {
							callbackContext.error(ex.getMessage());
						}
					}
				});
				callbackContext.success();
			}catch(Exception ex){
				Log.d(TAG, ex.getMessage());
				callbackContext.error("Invalid arg0(String), arg1(String), arg2(int)");
				return false;
			}
		}else {
			String message = "Unknown action : (" + action + ") " + args.getString(0);
			Log.d(TAG, message);
			callbackContext.error(message);
			return false;
		}

		return true;
	}
}

