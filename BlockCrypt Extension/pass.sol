// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Keychain {
    mapping(address => mapping(string => string)) private keychain;
    mapping(address => bool) private hasId; // Mapping to track if a user already has an ID

    event KeyValuePairSet(address indexed user, string key, string encryptedValue);

    // Function to set a new ID
    function setNewId(string memory key, string memory value) public {
        require(bytes(key).length > 0, "Key cannot be empty");
        require(!hasId[msg.sender], "User already has an ID"); 

        keychain[msg.sender][key] = value;
        hasId[msg.sender] = true; // Mark that the user now has an ID
        emit KeyValuePairSet(msg.sender, key, value);
    }

    // Function to save or update passwords
    function setKey(string memory key, string memory value) public {
        require(bytes(key).length > 0, "Key cannot be empty");
        require(hasId[msg.sender], "User does not have an ID");

        keychain[msg.sender][key] = value;
        emit KeyValuePairSet(msg.sender, key, value);
    }

    function getValue(string memory key) public view returns (string memory) {
        return keychain[msg.sender][key];
    }
}