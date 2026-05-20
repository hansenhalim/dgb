#pragma once
#include "BatteryMonitor.h"
#include "BleTransport.h"
#include "CommandParser.h"
#include "RFIDController.h"
#include "Response.h"
#include "SerialTransport.h"

class App {
public:
  App();
  void setup();
  void loop();

private:
  RFIDController rfid;
  SerialTransport serial;
  BleTransport ble;
  BatteryMonitor battery;
  ITransport *transports[2] = {&serial, &ble};

  void handleCommand(const String &cmd);
};
