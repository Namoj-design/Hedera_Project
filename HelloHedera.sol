// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

contract HelloHedera {
    // the contract's owner, set in the constructor
    address owner;

    // the message we're storing
    string message;

    constructor(string memory message_) {
        // set the owner of the contract for `kill()`
        owner = msg.sender;
        message = message_;
    }

    function set_message(string memory message_) public {
        // only allow the owner to update the message
        require(msg.sender == owner);
        message = message_;
    }

    // return a string
    function get_message() public view returns (string memory) {
        return message;
    }
}