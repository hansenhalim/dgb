#include "BleTransport.h"

// Nordic UART Service — de-facto standard "BLE serial" UUIDs.
#define NUS_SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_RX_CHAR_UUID "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_TX_CHAR_UUID "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

#define DEVICE_NAME "HANN-RFID-01"
// 0.625 ms units. 0xA0 = 160 = 100 ms — chosen so a ~2 s app scan reliably
// catches a disconnected reader.
#define ADV_INTERVAL_100MS 0xA0

void BleTransport::begin() {
  NimBLEDevice::init(DEVICE_NAME);

  pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(this);

  pService = pServer->createService(NUS_SERVICE_UUID);

  pRxChar = pService->createCharacteristic(
      NUS_RX_CHAR_UUID, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  pRxChar->setCallbacks(this);

  pTxChar =
      pService->createCharacteristic(NUS_TX_CHAR_UUID, NIMBLE_PROPERTY::NOTIFY);

  pServer->start();

  pAdv = NimBLEDevice::getAdvertising();
  pAdv->addServiceUUID(NUS_SERVICE_UUID);
  pAdv->enableScanResponse(true);
  pAdv->setName(DEVICE_NAME);
  pAdv->setMinInterval(ADV_INTERVAL_100MS);
  pAdv->setMaxInterval(ADV_INTERVAL_100MS);
  pAdv->start();
}

void BleTransport::poll() {}

bool BleTransport::hasLine() { return pendingReady; }

String BleTransport::readLine() {
  String line;
  portENTER_CRITICAL(&mux);
  line = pending;
  pending = "";
  pendingReady = false;
  portEXIT_CRITICAL(&mux);
  return line;
}

void BleTransport::sendLine(const String &message) {
  if (!connected)
    return;

  String framed = message + "\n";
  uint16_t mtu = pServer->getPeerMTU(connHandle);
  if (mtu < 23)
    mtu = 23;
  size_t chunkSize = mtu - 3;

  size_t total = framed.length();
  size_t offset = 0;
  while (offset < total) {
    size_t len = total - offset;
    if (len > chunkSize)
      len = chunkSize;
    pTxChar->notify((const uint8_t *)(framed.c_str() + offset), len);
    offset += len;
  }
}

void BleTransport::onWrite(NimBLECharacteristic *pChar, NimBLEConnInfo &) {
  NimBLEAttValue val = pChar->getValue();
  const uint8_t *data = val.data();
  size_t len = val.length();
  for (size_t i = 0; i < len; i++) {
    char c = (char)data[i];
    if (c == '\n') {
      assembly.trim();
      assembly.toUpperCase();
      portENTER_CRITICAL(&mux);
      if (!pendingReady) {
        pending = assembly;
        pendingReady = true;
      }
      portEXIT_CRITICAL(&mux);
      assembly = "";
    } else {
      assembly += c;
    }
  }
}

void BleTransport::onConnect(NimBLEServer *, NimBLEConnInfo &info) {
  connHandle = info.getConnHandle();
  connected = true;
}

void BleTransport::onDisconnect(NimBLEServer *, NimBLEConnInfo &, int) {
  connected = false;
  connHandle = 0xFFFF;
  NimBLEDevice::startAdvertising();
}
