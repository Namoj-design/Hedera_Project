const {
    Client,
    AccountId,
    PrivateKey,
    AccountCreateTransaction,
    AccountBalanceQuery,
    Hbar,
    TransferTransaction,
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    TokenMintTransaction,
    ContractCreateFlow,
    ContractExecuteTransaction,
    ContractCallQuery,
    ContractFunctionParameters
} = require("@hashgraph/sdk");

require("dotenv").config();
const fs = require("fs");

async function environmentSetup() {
    try {
        const myAccountId = process.env.MY_ACCOUNT_ID;
        const myPrivateKey = process.env.MY_PRIVATE_KEY;

        if (!myAccountId || !myPrivateKey) throw new Error("Environment variables MY_ACCOUNT_ID and MY_PRIVATE_KEY must be present");

        const operatorId = AccountId.fromString(myAccountId);
        const operatorKey = PrivateKey.fromStringED25519(myPrivateKey);

        const client = Client.forTestnet().setOperator(operatorId, operatorKey);
        client.setDefaultMaxTransactionFee(new Hbar(100));
        client.setMaxQueryPayment(new Hbar(50));
        client.setMaxAttempts(10);
        client.setRequestTimeout(300_000); // 5 minutes

        console.log("Generating new account...");
        const newAccountPrivateKey = PrivateKey.generateED25519();
        const newAccountPublicKey = newAccountPrivateKey.publicKey;

        const newAccountTx = await new AccountCreateTransaction()
            .setKey(newAccountPublicKey)
            .setInitialBalance(Hbar.fromTinybars(100000000)) // 1 Hbar
            .freezeWith(client);

        // Sign with operator key (payer) to fix INVALID_SIGNATURE
        const newAccountTxSign = await newAccountTx.sign(operatorKey);
        const newAccountTxSubmit = await newAccountTxSign.execute(client);
        const newAccountReceipt = await newAccountTxSubmit.getReceipt(client);
        const newAccountId = newAccountReceipt.accountId;
        console.log("New account created: " + newAccountId.toString());

        let newAccountBalance = await new AccountBalanceQuery().setAccountId(newAccountId).execute(client);
        console.log("New account balance: " + newAccountBalance.hbars.toTinybars() + " tinybars");

        // Token Operations
        const treasuryKey = newAccountPrivateKey;
        const supplyKey = treasuryKey;

        console.log("Creating Fungible Token...");
        try {
            const ftCreateTx = await new TokenCreateTransaction()
                .setTokenName("USD Bar")
                .setTokenSymbol("USDB")
                .setTokenType(TokenType.FungibleCommon)
                .setDecimals(2)
                .setInitialSupply(10000)
                .setTreasuryAccountId(newAccountId)
                .setSupplyType(TokenSupplyType.Infinite)
                .setSupplyKey(supplyKey)
                .freezeWith(client);
            const ftCreateTxSign = await ftCreateTx.sign(treasuryKey);
            const ftCreateSubmit = await ftCreateTxSign.execute(client);
            const ftCreateRx = await ftCreateSubmit.getReceipt(client);
            const ftTokenId = ftCreateRx.tokenId;
            console.log("Fungible Token created with ID:", ftTokenId.toString());

            console.log("Minting Fungible Tokens...");
            const mintFTTx = await new TokenMintTransaction().setTokenId(ftTokenId).setAmount(1000).freezeWith(client);
            const mintFTTxSign = await mintFTTx.sign(supplyKey);
            const mintFTTxSubmit = await mintFTTxSign.execute(client);
            const mintFTRx = await mintFTTxSubmit.getReceipt(client);
            console.log("Fungible Token minted, status:", mintFTRx.status.toString());
        } catch(err) {
            console.error("Error with fungible token operations:", err);
        }

        const updatedBalance = await new AccountBalanceQuery().setAccountId(newAccountId).execute(client);
        console.log("Updated account balance after FT creation: " + updatedBalance.hbars.toTinybars() + " tinybars");

        console.log("All token operations complete.");

        // ===============================
        // NEW: Smart Contract Operations
        // ===============================

        console.log("\n=== Deploying HelloHedera Smart Contract ===");

        // Load compiled contract JSON (replace with actual compiled artifact path)
        const contractJson = JSON.parse(fs.readFileSync("./HelloHedera.json", "utf8"));
        const bytecode = contractJson.bytecode.evm.bytecode.object;

        // Deploy contract
        const contractTx = new ContractCreateFlow()
            .setGas(3000000)
            .setBytecode(bytecode)
            .setConstructorParameters(
                new ContractFunctionParameters().addString("Hello from Hedera Smart Contract!")
            );

        const contractResponse = await contractTx.execute(client);
        const contractReceipt = await contractResponse.getReceipt(client);
        const contractId = contractReceipt.contractId;
        console.log("Contract deployed with ID:", contractId.toString());

        // Call setGlobalMessage
        console.log("Calling setGlobalMessage...");
        const setMessageTx = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(200000)
            .setFunction("setGlobalMessage", new ContractFunctionParameters().addString("Namoj says Hedera + Blockchain = Future 🚀"));
        const setMessageSubmit = await setMessageTx.execute(client);
        const setMessageRx = await setMessageSubmit.getReceipt(client);
        console.log("setGlobalMessage status:", setMessageRx.status.toString());

        // Query getGlobalMessage
        console.log("Querying getGlobalMessage...");
        const queryTx = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(200000)
            .setFunction("getGlobalMessage");
        const queryResult = await queryTx.execute(client);
        const globalMessage = queryResult.getString(0);
        console.log("Global message from contract:", globalMessage);

        // Call setMyMessage
        console.log("Calling setMyMessage...");
        const setMyMessageTx = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(200000)
            .setFunction("setMyMessage", new ContractFunctionParameters().addString("Namoj’s personal message on Hedera 🧑‍💻"));
        const setMyMessageSubmit = await setMyMessageTx.execute(client);
        const setMyMessageRx = await setMyMessageSubmit.getReceipt(client);
        console.log("setMyMessage status:", setMyMessageRx.status.toString());

        // Query getMyMessage
        console.log("Querying getMyMessage...");
        const queryMyMsg = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(200000)
            .setFunction("getMyMessage");
        const myMessageResult = await queryMyMsg.execute(client);
        const myMessage = myMessageResult.getString(0);
        console.log("My personal message from contract:", myMessage);

        console.log("Smart contract operations complete.");

    } catch (err) {
        console.error("Error during environment setup:", err);
    }
}

environmentSetup()
    .then(() => console.log("Setup complete"))
    .catch((err) => console.error("Setup failed:", err));