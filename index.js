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
    TokenBurnTransaction,
    TokenAssociateTransaction,
    TokenFreezeTransaction,
    TokenGrantKycTransaction,
    TokenPauseTransaction,
    TokenWipeTransaction,
    TokenNftInfoQuery
} = require("@hashgraph/sdk");

require("dotenv").config();

async function environmentSetup() {
    try {
        const myAccountId = process.env.MY_ACCOUNT_ID;
        const myPrivateKey = process.env.MY_PRIVATE_KEY;

        if (!myAccountId || !myPrivateKey) throw new Error("Environment variables MY_ACCOUNT_ID and MY_PRIVATE_KEY must be present");

        const operatorId = AccountId.fromString(myAccountId);
        const operatorKey = PrivateKey.fromStringED25519(myPrivateKey);

        let client;
        if (process.env.NETWORK === "local") {
            client = Client.forNetwork({"127.0.0.1:50211": new AccountId(3)})
                .setMirrorNetwork(["127.0.0.1:5600"])
                .setOperator(operatorId, operatorKey);
        } else {
            client = Client.forTestnet().setOperator(operatorId, operatorKey);
            client.setMirrorNetwork(["https://testnet.mirrornode.hedera.com:443"]);
        }

        client.setDefaultMaxTransactionFee(new Hbar(100));
        client.setMaxQueryPayment(new Hbar(50));
        client.setMaxAttempts(5);
        client.setRequestTimeout(120_000);

        // Generate new account
        const newAccountPrivateKey = PrivateKey.generateED25519();
        const newAccountPublicKey = newAccountPrivateKey.publicKey;
        console.log("New account private key: " + newAccountPrivateKey.toString());
        console.log("New account public key: " + newAccountPublicKey.toString());

        console.log("Creating new account with sufficient Hbar for token creation...");
        const newAccountTxResp = await new AccountCreateTransaction()
            .setKey(newAccountPublicKey)
            .setInitialBalance(Hbar.fromTinybars(10000000)) // increased balance to cover fees
            .execute(client);
        const newAccountReceipt = await newAccountTxResp.getReceipt(client);
        const newAccountId = newAccountReceipt.accountId;
        console.log("New account created: " + newAccountId.toString());

        let newAccountBalance = await new AccountBalanceQuery().setAccountId(newAccountId).execute(client);
        console.log("New account balance: " + newAccountBalance.hbars.toTinybars() + " tinybars");

        // Transfer Hbar
        const transferTx = await new TransferTransaction()
            .addHbarTransfer(operatorId, Hbar.fromTinybars(-10000000))
            .addHbarTransfer(newAccountId, Hbar.fromTinybars(10000000))
            .execute(client);
        await transferTx.getReceipt(client);
        console.log("Transfer complete.");

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

        console.log("Creating NFT Token...");
        try {
            const nftCreateTx = await new TokenCreateTransaction()
                .setTokenName("Diploma")
                .setTokenSymbol("GRAD")
                .setTokenType(TokenType.NonFungibleUnique)
                .setDecimals(0)
                .setInitialSupply(0)
                .setTreasuryAccountId(newAccountId)
                .setSupplyType(TokenSupplyType.Finite)
                .setSupplyKey(supplyKey)
                .freezeWith(client);
            const nftCreateTxSign = await nftCreateTx.sign(treasuryKey);
            const nftCreateSubmit = await nftCreateTxSign.execute(client);
            const nftCreateRx = await nftCreateSubmit.getReceipt(client);
            const nftTokenId = nftCreateRx.tokenId;
            console.log("NFT Token created with ID:", nftTokenId.toString());

            console.log("Minting NFT Token...");
            const CID = "ipfs://QmYourNFTMetadataHere";
            const mintNFTTx = await new TokenMintTransaction()
                .setTokenId(nftTokenId)
                .setMetadata([Buffer.from(CID)])
                .freezeWith(client);
            const mintNFTTxSign = await mintNFTTx.sign(supplyKey);
            const mintNFTTxSubmit = await mintNFTTxSign.execute(client);
            const mintNFTRx = await mintNFTTxSubmit.getReceipt(client);
            console.log(`NFT minted with serial: ${mintNFTRx.serials[0].low}`);
        } catch(err) {
            console.error("Error with NFT token operations:", err);
        }

        console.log("All token operations complete.");

    } catch (err) {
        console.error("Error during environment setup:", err);
    }
}

environmentSetup()
    .then(() => console.log("Setup complete"))
    .catch((err) => console.error("Setup failed:", err));