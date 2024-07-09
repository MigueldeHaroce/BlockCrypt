// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Keychain {
    mapping(address => mapping(string => string)) private keychain;

    event KeyValuePairSet(address indexed user, string key, string encryptedValue);

    function setKey(string memory key, string memory value) public {
        require(bytes(key).length > 0, "Key cannot be empty");
        keychain[msg.sender][key] = value;
        emit KeyValuePairSet(msg.sender, key, value);
    }

    function getValue(string memory key) public view returns (string memory) {
        return keychain[msg.sender][key];
    }
}
