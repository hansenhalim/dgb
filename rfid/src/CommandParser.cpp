#include "CommandParser.h"

ParsedCommand CommandParser::parse(const String &cmd) {
  ParsedCommand result;
  result.code = CommandCode::UNKNOWN;
  result.arg1 = "";
  result.arg2 = "";
  result.error = ParseError::NONE;
  result.errorDetails = "";
  result.originalCommand = cmd;

  // Split command into parts
  int firstSpace = cmd.indexOf(' ');
  String command;
  String args = "";

  if (firstSpace == -1) {
    command = cmd;
  } else {
    command = cmd.substring(0, firstSpace);
    args = cmd.substring(firstSpace + 1);
    args.trim();
  }

  // Parse commands
  if (command == "SCAN_UID") {
    if (args.length() > 0) {
      return createErrorResult(
          cmd, ParseError::INVALID_ARGUMENT_COUNT,
          "SCAN_UID command takes no arguments. Usage: SCAN_UID");
    }
    result.code = CommandCode::SCAN_UID;
  } else if (command == "READ") {
    if (args.length() == 0) {
      return createErrorResult(cmd, ParseError::MISSING_ARGUMENTS,
                               "READ command requires a 192-character hex key. "
                               "Usage: READ <192-hex-key>");
    }

    if (args.length() != 192) {
      return createErrorResult(
          cmd, ParseError::INVALID_HEX_LENGTH,
          "READ key must be exactly 192 hex characters. Provided: " +
              String(args.length()) + " characters");
    }

    if (!isValidHexString(args, 192)) {
      return createErrorResult(cmd, ParseError::INVALID_HEX_FORMAT,
                               "READ key contains invalid hex characters. Only "
                               "0-9, A-F, a-f allowed");
    }

    result.code = CommandCode::READ;
    result.arg1 = args;
  } else if (command == "WRITE") {
    if (args.length() == 0) {
      return createErrorResult(cmd, ParseError::MISSING_ARGUMENTS,
                               "WRITE command requires key and data. Usage: "
                               "WRITE <192-hex-key> <1024-hex-data>");
    }

    int spacePos = args.indexOf(' ');
    if (spacePos == -1) {
      return createErrorResult(
          cmd, ParseError::INVALID_ARGUMENT_COUNT,
          "WRITE command requires both key and data separated by space. Usage: "
          "WRITE <192-hex-key> <1024-hex-data>");
    }

    String key = args.substring(0, spacePos);
    String data = args.substring(spacePos + 1);
    key.trim();
    data.trim();

    if (key.length() != 192) {
      return createErrorResult(
          cmd, ParseError::INVALID_HEX_LENGTH,
          "WRITE key must be exactly 192 hex characters. Provided: " +
              String(key.length()) + " characters");
    }

    if (!isValidHexString(key, 192)) {
      return createErrorResult(cmd, ParseError::INVALID_HEX_FORMAT,
                               "WRITE key contains invalid hex characters. "
                               "Only 0-9, A-F, a-f allowed");
    }

    if (data.length() != 1024) {
      return createErrorResult(
          cmd, ParseError::INVALID_HEX_LENGTH,
          "WRITE data must be exactly 1024 hex characters. Provided: " +
              String(data.length()) + " characters");
    }

    if (!isValidHexString(data, 1024)) {
      return createErrorResult(cmd, ParseError::INVALID_HEX_FORMAT,
                               "WRITE data contains invalid hex characters. "
                               "Only 0-9, A-F, a-f allowed");
    }

    result.code = CommandCode::WRITE;
    result.arg1 = key;
    result.arg2 = data;
  } else if (command == "VERSION") {
    if (args.length() > 0) {
      return createErrorResult(
          cmd, ParseError::INVALID_ARGUMENT_COUNT,
          "VERSION command takes no arguments. Usage: VERSION");
    }
    result.code = CommandCode::VERSION;
  } else if (command == "ENROLL") {
    if (args.length() == 0) {
      return createErrorResult(cmd, ParseError::MISSING_ARGUMENTS,
                               "ENROLL command requires a 96-byte hex key. "
                               "Usage: ENROLL <96-hex-key>");
    }

    if (args.length() != 192) {
      return createErrorResult(cmd, ParseError::INVALID_HEX_LENGTH,
                               "ENROLL key must be exactly 192 hex characters "
                               "(96 bytes). Provided: " +
                                   String(args.length()) + " characters");
    }

    if (!isValidHexString(args, 192)) {
      return createErrorResult(cmd, ParseError::INVALID_HEX_FORMAT,
                               "ENROLL key contains invalid hex characters. "
                               "Only 0-9, A-F, a-f allowed");
    }

    result.code = CommandCode::ENROLL;
    result.arg1 = args;
  } else if (command == "HELP") {
    result.code = CommandCode::HELP;
    if (args.length() > 0) {
      result.arg1 = args; // Store the specific command to get help for
    }
  } else {
    return createErrorResult(cmd, ParseError::UNKNOWN_COMMAND,
                             "Unknown command '" + command + "'. " +
                                 getAllCommandsHelp());
  }

  return result;
}

ParsedCommand CommandParser::createErrorResult(const String &originalCmd,
                                               ParseError error,
                                               const String &details) {
  ParsedCommand result;
  result.code = CommandCode::UNKNOWN;
  result.arg1 = "";
  result.arg2 = "";
  result.error = error;
  result.errorDetails = details;
  result.originalCommand = originalCmd;
  return result;
}

String CommandParser::getCommandHelp(const String &command) {
  if (command == "SCAN_UID") {
    return "SCAN_UID - Scans for RFID tag and returns UID. Takes no arguments. "
           "Example: SCAN_UID";
  } else if (command == "READ") {
    return "READ <192-hex-key> - Reads data from RFID tag using authentication "
           "key. Key must be exactly 192 hex characters (0-9, A-F). Example: "
           "READ A1B2C3D4E5F6...";
  } else if (command == "WRITE") {
    return "WRITE <192-hex-key> <1024-hex-data> - Writes data to RFID tag. "
           "Key: 192 hex chars, Data: 1024 hex chars. Example: WRITE A1B2C3... "
           "1234ABCD...";
  } else if (command == "VERSION") {
    return "VERSION - Returns the RFID reader firmware version. Takes no "
           "arguments. Example: VERSION";
  } else if (command == "ENROLL") {
    return "ENROLL <96-hex-key> - Changes the fourth block (sector trailer) in "
           "each sector with new authentication keys. Key must be exactly 192 "
           "hex characters (96 bytes). Example: ENROLL A1B2C3D4E5F6...";
  } else if (command == "HELP") {
    return "HELP [command] - Shows help information. Use without arguments for "
           "all commands, or specify a command for detailed help. Example: "
           "HELP READ";
  } else {
    return "Unknown command: " + command +
           ". Use HELP to see available commands.";
  }
}

String CommandParser::getAllCommandsHelp() {
  return "Available commands: SCAN_UID, READ <key>, WRITE <key> <data>, ENROLL "
         "<key>, VERSION, HELP [command]. Use 'HELP <command>' for detailed "
         "help on specific commands.";
}

bool CommandParser::isValidHexString(const String &str, int expectedLength) {
  if (str.length() != expectedLength)
    return false;

  for (int i = 0; i < str.length(); i++) {
    char c = str.charAt(i);
    if (!((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') ||
          (c >= 'a' && c <= 'f'))) {
      return false;
    }
  }
  return true;
}
