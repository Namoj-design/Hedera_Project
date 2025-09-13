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
    TokenMintTransaction
} = require("@hashgraph/sdk");

require("dotenv").config();

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
        let newAccountId, newAccountPrivateKey;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                newAccountPrivateKey = PrivateKey.generateED25519();
                const newAccountPublicKey = newAccountPrivateKey.publicKey;
                console.log(`Attempt ${attempt}: Creating new account...`);

                const newAccountTx = await new AccountCreateTransaction()
                    .setKey(newAccountPublicKey)
                    .setInitialBalance(Hbar.fromTinybars(100000000)) // 1 Hbar
                    .freezeWith(client);

                // Sign with operator key (payer) to fix INVALID_SIGNATURE
                const newAccountTxSign = await newAccountTx.sign(operatorKey);
                const newAccountTxSubmit = await newAccountTxSign.execute(client);
                const newAccountReceipt = await newAccountTxSubmit.getReceipt(client);
                newAccountId = newAccountReceipt.accountId;
                console.log("New account created: " + newAccountId.toString());
                break;

            } catch (err) {
                console.warn(`Attempt ${attempt} failed: ${err.message}`);
                if (attempt === 5) throw new Error("Failed to create new account after 5 attempts.");
                await new Promise(res => setTimeout(res, 5000));
            }
        }

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

        console.log("All token operations complete.");

    } catch (err) {
        console.error("Error during environment setup:", err);
    }
}

environmentSetup()
    .then(() => console.log("Setup complete"))
    .catch((err) => console.error("Setup failed:", err));