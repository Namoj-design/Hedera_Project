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
    const myAccountId = process.env.MY_ACCOUNT_ID;
    const myPrivateKey = process.env.MY_PRIVATE_KEY;

    if (!myAccountId || !myPrivateKey) {
        throw new Error("Environment variables MY_ACCOUNT_ID and MY_PRIVATE_KEY must be present");
    }

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

    const newAccountPrivateKey = PrivateKey.generateED25519();
    const newAccountPublicKey = newAccountPrivateKey.publicKey;

    console.log("New account private key: " + newAccountPrivateKey.toString());
    console.log("New account public key: " + newAccountPublicKey.toString());

    const newAccountTransactionResponse = await new AccountCreateTransaction()
        .setKey(newAccountPublicKey)
        .setInitialBalance(Hbar.fromTinybars(1000))
        .execute(client);

    const newAccountReceipt = await newAccountTransactionResponse.getReceipt(client);
    const newAccountId = newAccountReceipt.accountId;
    console.log("New account created: " + newAccountId.toString());

    let newAccountBalance = await new AccountBalanceQuery().setAccountId(newAccountId).execute(client);
    console.log("New account balance: " + newAccountBalance.hbars.toTinybars() + " tinybars");

    // Transfer Hbar
    const transferTx = await new TransferTransaction()
        .addHbarTransfer(operatorId, Hbar.fromTinybars(-1000))
        .addHbarTransfer(newAccountId, Hbar.fromTinybars(1000))
        .execute(client);
    await transferTx.getReceipt(client);
    console.log("Transfer complete.");

    // Fungible Token Creation
    const treasuryKey = newAccountPrivateKey;
    const supplyKey = treasuryKey;
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

    // NFT Creation
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

    // Mint Fungible Tokens
    const mintFTTx = await new TokenMintTransaction().setTokenId(ftTokenId).setAmount(1000).freezeWith(client);
    const mintFTTxSign = await mintFTTx.sign(supplyKey);
    const mintFTTxSubmit = await mintFTTxSign.execute(client);
    const mintFTRx = await mintFTTxSubmit.getReceipt(client);
    console.log("Fungible Token minted, status:", mintFTRx.status.toString());

    // Mint NFT with metadata
    const CID = "ipfs://QmYourNFTMetadataHere";
    const mintNFTTx = await new TokenMintTransaction()
        .setTokenId(nftTokenId)
        .setMetadata([Buffer.from(CID)])
        .freezeWith(client);
    const mintNFTTxSign = await mintNFTTx.sign(supplyKey);
    const mintNFTTxSubmit = await mintNFTTxSign.execute(client);
    const mintNFTRx = await mintNFTTxSubmit.getReceipt(client);
    console.log(`NFT minted with serial: ${mintNFTRx.serials[0].low}`);

    // Associate token with new account
    const associateTx = await new TokenAssociateTransaction()
        .setAccountId(newAccountId)
        .setTokenIds([ftTokenId, nftTokenId])
        .freezeWith(client);
    const associateTxSign = await associateTx.sign(newAccountPrivateKey);
    const associateTxSubmit = await associateTxSign.execute(client);
    await associateTxSubmit.getReceipt(client);
    console.log("Token association complete.");

    // Token Freeze example (freeze NFT for newAccountId)
    const freezeTx = await new TokenFreezeTransaction()
        .setAccountId(newAccountId)
        .setTokenId(nftTokenId)
        .freezeWith(client);
    const freezeTxSign = await freezeTx.sign(treasuryKey);
    const freezeTxSubmit = await freezeTxSign.execute(client);
    await freezeTxSubmit.getReceipt(client);
    console.log("Token freeze complete.");

    // Token Grant KYC example (grant KYC for fungible token to newAccountId)
    const grantKycTx = await new TokenGrantKycTransaction()
        .setAccountId(newAccountId)
        .setTokenId(ftTokenId)
        .freezeWith(client);
    const grantKycTxSign = await grantKycTx.sign(treasuryKey);
    const grantKycTxSubmit = await grantKycTxSign.execute(client);
    await grantKycTxSubmit.getReceipt(client);
    console.log("KYC granted.");

    // Token Pause example (pause fungible token)
    const pauseTx = await new TokenPauseTransaction()
        .setTokenId(ftTokenId)
        .freezeWith(client);
    const pauseTxSign = await pauseTx.sign(treasuryKey);
    const pauseTxSubmit = await pauseTxSign.execute(client);
    await pauseTxSubmit.getReceipt(client);
    console.log("Token paused.");

    // Token Wipe example (wipe fungible tokens from newAccountId)
    const wipeTx = await new TokenWipeTransaction()
        .setAccountId(newAccountId)
        .setTokenId(ftTokenId)
        .setAmount(10)
        .freezeWith(client);
    const wipeTxSign = await wipeTx.sign(treasuryKey);
    const wipeTxSubmit = await wipeTxSign.execute(client);
    await wipeTxSubmit.getReceipt(client);
    console.log("Tokens wiped from account.");

    // Transfer Fungible Token example
    const transferFTTx = await new TransferTransaction()
        .addTokenTransfer(ftTokenId, newAccountId, -10)
        .addTokenTransfer(ftTokenId, operatorId, 10)
        .freezeWith(client);
    const transferFTTxSign = await transferFTTx.sign(newAccountPrivateKey);
    const transferFTTxSubmit = await transferFTTxSign.execute(client);
    await transferFTTxSubmit.getReceipt(client);
    console.log("Fungible Token transfer complete.");

    // Transfer NFT example
    const transferNFTTx = await new TransferTransaction()
        .addNftTransfer(nftTokenId, 1, newAccountId, operatorId)
        .freezeWith(client)
        .sign(newAccountPrivateKey);
    const transferNFTSubmit = await transferNFTTx.execute(client);
    await transferNFTSubmit.getReceipt(client);
    console.log("NFT transfer complete.");

    process.exit(0);
}

environmentSetup()
    .then(() => console.log("Setup complete"))
    .catch((err) => console.error("Error during setup:", err));