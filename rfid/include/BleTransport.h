#pragma once
#include "ITransport.h"
#include <NimBLEDevice.h>

class BleTransport : public ITransport,
                     public NimBLECharacteristicCallbacks,
                     public NimBLEServerCallbacks {
public:
  void begin() override;
  void poll() override;
  bool hasLine() override;
  String readLine() override;
  void sendLine(const String &message) override;

  void onWrite(NimBLECharacteristic *pChar, NimBLEConnInfo &connInfo) override;
  void onConnect(NimBLEServer *pServer, NimBLEConnInfo &connInfo) override;
  void onDisconnect(NimBLEServer *pServer, NimBLEConnInfo &connInfo,
                    int reason) override;

private:
  NimBLEServer *pServer = nullptr;
  NimBLEService *pService = nullptr;
  NimBLECharacteristic *pRxChar = nullptr;
  NimBLECharacteristic *pTxChar = nullptr;
  NimBLEAdvertising *pAdv = nullptr;

  String assembly;
  String pending;
  volatile bool pendingReady = false;
  portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

  uint16_t connHandle = 0xFFFF;
  bool connected = false;
};
