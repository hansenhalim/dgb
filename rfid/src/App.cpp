#include "App.h"

App::App() {}

void App::setup() {
  serial.begin();
  ble.begin();
  rfid.begin();
}

void App::loop() {
  for (ITransport *t : transports) {
    t->poll();
    while (t->hasLine()) {
      Response::setTransport(t);
      handleCommand(t->readLine());
    }
  }

  uint8_t pct;
  if (battery.poll(millis(), pct)) {
    // Push event — uniform with command responses but routed past the
    // command/response state machine on the app side via the EVT prefix.
    ble.sendLine("EVT BATT " + String(pct));
  }
}

void App::handleCommand(const String &cmd) {
  ParsedCommand parsed = CommandParser::parse(cmd);

  // Handle parsing errors first
  if (parsed.error != ParseError::NONE) {
    String errorCode;
    switch (parsed.error) {
    case ParseError::UNKNOWN_COMMAND:
      errorCode = "UNKNOWN_CMD";
      break;
    case ParseError::INVALID_ARGUMENT_COUNT:
      errorCode = "INVALID_ARGS";
      break;
    case ParseError::INVALID_HEX_FORMAT:
      errorCode = "INVALID_HEX";
      break;
    case ParseError::INVALID_HEX_LENGTH:
      errorCode = "INVALID_LENGTH";
      break;
    case ParseError::MISSING_ARGUMENTS:
      errorCode = "MISSING_ARGS";
      break;
    default:
      errorCode = "PARSE_ERROR";
      break;
    }

    Response::sendVerboseError(errorCode, parsed.errorDetails,
                               "Command: '" + parsed.originalCommand + "'");
    return;
  }

  // Handle valid commands
  switch (parsed.code) {
  case CommandCode::SCAN_UID: {
    String uid = rfid.scanUID();
    if (uid.length() > 0) {
      Response::sendOK("UID " + uid);
    } else {
      Response::sendVerboseError("NO_TAG", "No RFID tag detected in range",
                                 "SCAN_UID operation");
    }
  } break;

  case CommandCode::READ: {
    ReadStatus status;
    String data = rfid.readData(parsed.arg1, status);
    if (status == ReadStatus::OK) {
      Response::sendOK("DATA " + data);
    } else if (status == ReadStatus::AUTH_FAILED) {
      Response::sendVerboseError("AUTH_FAILED",
                                 "Sector authentication failed (wrong key)",
                                 "READ operation with provided key");
    } else {
      Response::sendVerboseError(
          "NO_TAG_DURING_READ",
          "Antenna lost the card between SCAN_UID and READ",
          "READ operation - re-tap card and retry");
    }
  } break;

  case CommandCode::WRITE: {
    bool success = rfid.writeData(parsed.arg1, parsed.arg2);
    if (success) {
      Response::sendOK("WRITE_DONE");
    } else {
      Response::sendVerboseError(
          "WRITE_FAIL", "Failed to write data to RFID tag",
          "WRITE operation - check tag presence and key validity");
    }
  } break;

  case CommandCode::ENROLL: {
    bool success = rfid.enrollKey(parsed.arg1);
    if (success) {
      Response::sendOK("ENROLL_DONE");
    } else {
      Response::sendVerboseError(
          "ENROLL_FAIL", "Failed to enroll keys to RFID tag",
          "ENROLL operation - check tag presence and authentication");
    }
  } break;

  case CommandCode::VERSION: {
    String version = rfid.getVersion();
    Response::sendOK("VERSION " + version);
  } break;

  case CommandCode::HELP: {
    if (parsed.arg1.length() > 0) {
      // Help for specific command
      String helpText = CommandParser::getCommandHelp(parsed.arg1);
      Response::sendOK("HELP " + helpText);
    } else {
      // General help
      String helpText = CommandParser::getAllCommandsHelp();
      Response::sendOK("HELP " + helpText);
    }
  } break;

  default:
    // This should not happen with the new parser, but keep as fallback
    Response::sendVerboseError(
        "UNKNOWN_CMD", "Unrecognized command received",
        "Valid commands: SCAN_UID, READ, WRITE, VERSION, HELP");
    break;
  }
}
