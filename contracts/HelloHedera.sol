// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract DynamicHelloHedera {
    // contract owner (immutable to save gas)
    address public immutable owner;

    // default global message (editable only by owner)
    string private globalMessage;

    // per-user messages
    mapping(address => string) private userMessages;

    // events for off-chain tracking
    event GlobalMessageUpdated(address indexed by, string newMessage);
    event UserMessageUpdated(address indexed user, string newMessage);

    // modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    constructor(string memory initialMessage) {
        owner = msg.sender;
        globalMessage = initialMessage;
    }

    // update global message (owner only)
    function setGlobalMessage(string calldata newMessage) external onlyOwner {
        globalMessage = newMessage;
        emit GlobalMessageUpdated(msg.sender, newMessage);
    }

    // read global message
    function getGlobalMessage() external view returns (string memory) {
        return globalMessage;
    }

    // set personal message (anyone can do it)
    function setMyMessage(string calldata newMessage) external {
        userMessages[msg.sender] = newMessage;
        emit UserMessageUpdated(msg.sender, newMessage);
    }

    // get your own message
    function getMyMessage() external view returns (string memory) {
        return userMessages[msg.sender];
    }

    // get a specific user's message (optional, for transparency)
    function getUserMessage(address user) external view returns (string memory) {
        return userMessages[user];
    }
}