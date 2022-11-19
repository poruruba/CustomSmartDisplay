package jp.or.sample.plugin.SampleSensor;

import android.app.Activity;
import android.content.Intent;
import android.content.Context;
import android.util.Log;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaWebView;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

public class Main extends CordovaPlugin implements SensorEventListener{
	public static String TAG = "SampleSensor.Main";
	private Activity activity;
	
    private SensorManager sensorManager;
    Map<String, float[]> values = new HashMap<>();
    Map<String, Sensor> targetSensors = new HashMap<>();
    Map<String, Integer> supportedSensors = new HashMap<>();

	@Override
	public void initialize(CordovaInterface cordova, CordovaWebView webView)
	{
		Log.d(TAG, "[Plugin] initialize called");
		super.initialize(cordova, webView);

		activity = cordova.getActivity();

	    sensorManager = (SensorManager) activity.getSystemService(Context.SENSOR_SERVICE);
        List<Sensor> deviceSensors = sensorManager.getSensorList(Sensor.TYPE_ALL);
        for( Sensor sensor: deviceSensors){
            supportedSensors.put(sensor.getStringType(), sensor.getType());
        }
	}

	@Override
	public void onResume(boolean multitasking)
	{
		Log.d(TAG, "[Plugin] onResume called");
		super.onResume(multitasking);
        for (String key : targetSensors.keySet()) {
            Sensor sensor = targetSensors.get(key);
            sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL);
        }
	}

	@Override
	public void onPause(boolean multitasking)
	{
		Log.d(TAG, "[Plugin] onPause called");
		super.onPause(multitasking);
		sensorManager.unregisterListener(this);
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
		if( action.equals("addDevice") ){
			try{
				String deviceName = args.getString(0);
				int type = supportedSensors.get(deviceName);
				Sensor sensor = targetSensors.get(deviceName);
				if( sensor == null ){
                	Sensor defaultSensor = sensorManager.getDefaultSensor(type);
					if (defaultSensor != null){
                    	targetSensors.put(deviceName, defaultSensor);
						sensorManager.registerListener(this, defaultSensor, SensorManager.SENSOR_DELAY_NORMAL);
					}
				}
				callbackContext.success();
			}catch(Exception ex){
				callbackContext.error(ex.getMessage());
			}
		}else
		if( action.equals("removeDevice") ){
			try{
				String deviceName = args.getString(0);
				Sensor sensor = targetSensors.get(deviceName);
				if( sensor != null ){
					sensorManager.unregisterListener(this, sensor);
					targetSensors.remove(deviceName);
					values.remove(deviceName);
				}
				callbackContext.success();
			}catch(Exception ex){
				callbackContext.error(ex.getMessage());
			}
		}else
		if( action.equals("getValue") ){
			try{
				String deviceName = args.getString(0);
				float[] list = values.get(deviceName);

				JSONObject result = new JSONObject();
				JSONArray array = new JSONArray();
				for (int i = 0; i < list.length; i++)
				    array.put(list[i]);
				result.put("value", array);
				
				callbackContext.success(result);
			} catch (Exception ex) {
				callbackContext.error(ex.getMessage());
			}
		}else
		if( action.equals("getSupportedDevices") ){
			try{
				JSONObject result = new JSONObject();
				JSONArray array = new JSONArray();
				for (String key : supportedSensors.keySet()) {
				    array.put(key);
				}
				result.put("list", array);
				
				callbackContext.success(result);
			} catch (Exception ex) {
				callbackContext.error(ex.getMessage());
			}
		}else {
			String message = "Unknown action : (" + action + ") " + args.getString(0);
			Log.d(TAG, message);
			callbackContext.error(message);
			return false;
		}

		return true;
	}
	
    @Override
    public void onSensorChanged(SensorEvent sensorEvent) {
        values.put(sensorEvent.sensor.getStringType(), sensorEvent.values);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int i) {
        // Do something here if sensor accuracy changes.
    }
}

