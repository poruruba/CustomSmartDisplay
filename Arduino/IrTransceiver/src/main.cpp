#include <Arduino.h>

#include <IRSend.h>
#include <IRrecv.h>
#include <IRremoteESP8266.h>
#include <IRutils.h>

#include <ArduinoJson.h>
#include <base64.hpp>

#if defined(ARDUINO_M5Stick_C) 
#include <M5StickC.h>
#include <WiFi.h>
#define IR_RECV_PORT 33
#define IR_SEND_PORT 32
#elif defined(ARDUINO_M5Stack_ATOM)
#include <M5Atom.h>
#include <WiFi.h>
#define IR_SEND_PORT 26
#define IR_RECV_PORT 32
#elif defined(ARDUINO_ESP32C3_DEV) 
#include <WiFi.h>
#define IR_SEND_PORT 1
#define IR_RECV_PORT 0
#elif defined(ARDUINO_ESP8266_ESP_WROOM_02)
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#define IR_SEND_PORT 14
#define IR_RECV_PORT 5
#endif

#include <WiFiUdp.h>

static WiFiUDP udp;

#define JSON_CAPACITY 1024
static StaticJsonDocument<JSON_CAPACITY> jsonDoc;

static IRsend irsend(IR_SEND_PORT);
static IRrecv irrecv(IR_RECV_PORT);
static decode_results results;

#define UDP_RECV_PORT 20001
#define UDP_REMOTE_PORT 20001
#define UDP_REMOTE_ADDRESS 0xC0A80118 /* Node.jsサーバのIPアドレス */

//#define WIFI_SSID "【固定のWiFiアクセスポイントのSSID】" // WiFiアクセスポイントのSSID
//#define WIFI_PASSWORD "【固定のWiFIアクセスポイントのパスワード】" // WiFIアクセスポイントのパスワード
#define WIFI_SSID NULL // WiFiアクセスポイントのSSID
#define WIFI_PASSWORD NULL // WiFIアクセスポイントのパスワード
#define WIFI_TIMEOUT  10000
#define SERIAL_TIMEOUT1  10000
#define SERIAL_TIMEOUT2  20000
static long wifi_try_connect(bool infinit_loop);

static long udpSend(JsonDocument& jdoc, IPAddress ipaddress, uint16_t port);
static long irSend(const uint16_t *p_data, uint16_t len);
static long process_ir_receive(void);
static long process_udp_receive(int packetSize);

unsigned long b64_encode_length(unsigned long input_length);
unsigned long b64_encode(const unsigned char input[], unsigned long input_length, char output[]);
unsigned long b64_decode_length(const char input[]);
unsigned long b64_decode(const char input[], unsigned char output[]);

static void dump_bin(const char *p_message, const unsigned char *p_bin, int len){
  Serial.printf("%s", p_message);
  for( int i = 0 ; i < len ; i++ )
    Serial.printf("%02x", p_bin[i]);
  Serial.println("");
}

void setup() {
  // put your setup code here, to run once:
#if defined(ARDUINO_M5Stick_C) 
  M5.begin(true, true, true);
#elif defined(ARDUINO_M5Stack_ATOM)
  M5.begin(true, true, false);
#else
  Serial.begin(115200);
#endif

  Serial.println("setup start");

  wifi_try_connect(true);

  udp.begin(UDP_RECV_PORT);

  irrecv.enableIRIn();
  irsend.begin();

  Serial.println("setup finished");
}

void loop() {
  // put your main code here, to run repeatedly:
#if defined(ARDUINO_ESP8266_ESP_WROOM_02)
#elif defined(ARDUINO_ESP32C3_DEV)
#else
  M5.update();
#endif

  int packetSize = udp.parsePacket();
  if( packetSize > 0 ){
    long ret = process_udp_receive(packetSize);
    if( ret != 0 )
      Serial.println("process_udp_receive Error");
  }

  if (irrecv.decode(&results)) {
    long ret = process_ir_receive();
    if( ret != 0 )
      Serial.println("process_ir_receive Error");
  }

  delay(1);
}

static long process_udp_receive(int packetSize)
{
  Serial.println("process_udp_receive");
  uint8_t *p_buffer = (uint8_t*)malloc(packetSize + 1);
  if( p_buffer == NULL )
    return -1;
  
  int len = udp.read(p_buffer, packetSize);
  if( len <= 0 ){
    free(p_buffer);
    return -1;
  }
  p_buffer[len] = '\0';

  DeserializationError error = deserializeJson(jsonDoc, p_buffer, len);
  if( error ){
    Serial.println("Deserialize Error");
    free(p_buffer);
    return -1;
  }

  const char *cmd_type = jsonDoc["type"];
  if( strcmp(cmd_type, "ir_send") != 0 ){
    free(p_buffer);
    return -1;
  }

  const char *p_b64 = jsonDoc["rawbuf"];
  if( p_b64 == NULL ){
    free(p_buffer);
    return -1;
  }
  int rawlen = b64_decode_length(p_b64);
  uint16_t *p_raw = (uint16_t*)malloc(rawlen);
  if( p_raw == NULL ){
    free(p_buffer);
    return -1;
  }

  unsigned long declen = b64_decode(p_b64, (unsigned char*)p_raw);
  free(p_buffer);

  long ret = irSend(p_raw, declen / 2);
  free(p_raw);
  irrecv.resume();
  if( ret != 0 )
    return ret;

  return 0;
}

static long process_ir_receive(void)
{
  Serial.println("process_ir_receive");

  if(results.overflow){
    irrecv.resume();
    Serial.println("Overflow");
    return -1;
  }
  if( results.decode_type == decode_type_t::UNKNOWN || results.repeat ){
    irrecv.resume();
    Serial.println("not supported");
    return -1;
  }

  uint16_t *p_rawbuf = resultToRawArray(&results);
  uint16_t rawlen = getCorrectedRawLength(&results);
  int len = b64_encode_length(rawlen * 2);
  char *p_b64 = (char*)malloc(len + 1);
  if( p_b64 == NULL ){
    delete[] p_rawbuf;
    irrecv.resume();
    return -1;
  }
  unsigned long b64len = b64_encode((unsigned char*)p_rawbuf, rawlen * 2, p_b64);
  p_b64[b64len] = '\0';
  delete[] p_rawbuf;

  jsonDoc.clear();
  jsonDoc["type"] = "ir_receive";
  jsonDoc["rawbuf"] = p_b64;
  jsonDoc["decode_type"] = results.decode_type;
  jsonDoc["address"] = results.address;
  jsonDoc["command"] = results.command;

  long ret = udpSend(jsonDoc, IPAddress((UDP_REMOTE_ADDRESS >> 24) & 0xff, (UDP_REMOTE_ADDRESS >> 16) & 0xff, (UDP_REMOTE_ADDRESS >> 8) & 0xff, (UDP_REMOTE_ADDRESS >> 0) & 0xff), UDP_REMOTE_PORT );
  free(p_b64);
  if( ret != 0 ){
    irrecv.resume();
    Serial.println("udpSend error");
    return ret;
  }

  irrecv.resume();

  return 0;
}

static long wifi_connect(const char *ssid, const char *password, unsigned long timeout)
{
  Serial.println("");
  Serial.print("WiFi Connenting");

  if( ssid == NULL && password == NULL )
    WiFi.begin();
  else
    WiFi.begin(ssid, password);
  unsigned long past = 0;
  while (WiFi.status() != WL_CONNECTED){
    Serial.print(".");
    delay(500);
    past += 500;
    if( past > timeout ){
      Serial.println("\nCan't Connect");
      return -1;
    }
  }
  Serial.print("\nConnected : IP=");
  Serial.print(WiFi.localIP());
  Serial.print(" Mac=");
  Serial.println(WiFi.macAddress());

  return 0;
}

static long wifi_try_connect(bool infinit_loop)
{
  long ret = -1;
  do{
    ret = wifi_connect(WIFI_SSID, WIFI_PASSWORD, WIFI_TIMEOUT);
    if( ret == 0 )
      return ret;

    Serial.print("\ninput SSID:");
    Serial.setTimeout(SERIAL_TIMEOUT1);
    char ssid[32 + 1] = {'\0'};
    ret = Serial.readBytesUntil('\r', ssid, sizeof(ssid) - 1);
    if( ret <= 0 )
      continue;

    delay(10);
    Serial.read();
    Serial.print("\ninput PASSWORD:");
    Serial.setTimeout(SERIAL_TIMEOUT2);
    char password[32 + 1] = {'\0'};
    ret = Serial.readBytesUntil('\r', password, sizeof(password) - 1);
    if( ret <= 0 )
      continue;

    delay(10);
    Serial.read();
    Serial.printf("\nSSID=%s PASSWORD=", ssid);
    for( int i = 0 ; i < strlen(password); i++ )
      Serial.print("*");
    Serial.println("");

    ret = wifi_connect(ssid, password, WIFI_TIMEOUT);
    if( ret == 0 )
      return ret;
  }while(infinit_loop);

  return ret;
}

static long udpSend(JsonDocument& jdoc, IPAddress ipaddress, uint16_t port)
{
  int len = measureJson(jdoc);
  char *p_buffer = (char*)malloc(len + 1);
  if( p_buffer == NULL )
    return -1;
  int wroteLen = serializeJson(jdoc, p_buffer, len);
  p_buffer[wroteLen] = '\0';
  Serial.printf("udpSend: %s\n\n", p_buffer);

  udp.beginPacket(ipaddress, port);
  udp.write((const uint8_t*)p_buffer, wroteLen);
  udp.endPacket();

  free(p_buffer);

  return 0;
}

static long irSend(const uint16_t *p_data, uint16_t len){
  Serial.printf("irSend(%d)\n", len);
  irsend.sendRaw(p_data, len, 38);
  return 0;
}

unsigned long b64_encode_length(unsigned long input_length)
{
  return encode_base64_length(input_length);
}

unsigned long b64_encode(const unsigned char input[], unsigned long input_length, char output[])
{
  return encode_base64((unsigned char*)input, input_length, (unsigned char*)output);
}

unsigned long b64_decode_length(const char input[])
{
  return decode_base64_length((unsigned char*)input);
}

unsigned long b64_decode(const char input[], unsigned char output[])
{
  return decode_base64((unsigned char*)input, output);
}
