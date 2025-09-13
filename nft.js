const {
    Client,
    AccountId,
    PrivateKey,
    Hbar,
    AccountCreateTransaction,
    AccountBalanceQuery,
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    TokenMintTransaction,
    TokenAssociateTransaction,
    TransferTransaction
} = require("@hashgraph/sdk");
require("dotenv").config();

const MAX_RETRIES = 5;
const MAX_BATCH_SIZE = 5;

async function executeTransaction(transaction, key, client) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const txSign = await transaction.sign(key);
            const txSubmit = await txSign.execute(client);
            const txReceipt = await txSubmit.getReceipt(client);
            return txReceipt;
        } catch (err) {
            if (err.toString().includes('BUSY')) {
                retries++;
                console.log(`Hedera BUSY retry attempt: ${retries}`);
                await new Promise(res => setTimeout(res, 2000));
            } else {
                throw err;
            }
        }
    }
    throw new Error(`Transaction failed after ${MAX_RETRIES} attempts`);
}

async function mintNFTBatch(tokenId, metadataArray, supplyKey, client) {
    for (let i = 0; i < metadataArray.length; i += MAX_BATCH_SIZE) {
        const batch = metadataArray.slice(i, i + MAX_BATCH_SIZE);
        const mintTx = new TokenMintTransaction()
            .setTokenId(tokenId)
            .setMetadata(batch)
            .freezeWith(client);
        const mintRx = await executeTransaction(mintTx, supplyKey, client);
        console.log(`Minted NFT batch with serials: ${mintRx.serials}`);
    }
}

async function main() {
    const operatorId = AccountId.fromString(process.env.MY_ACCOUNT_ID);
    const operatorKey = PrivateKey.fromStringED25519(process.env.MY_PRIVATE_KEY);

    const client = Client.forTestnet().setOperator(operatorId, operatorKey);
    client.setDefaultMaxTransactionFee(new Hbar(100));
    client.setMaxQueryPayment(new Hbar(50));
    client.setMaxAttempts(10);
    client.setRequestTimeout(300000);

    // Use operator as treasury account
    const treasuryKey = operatorKey;
    const supplyKey = treasuryKey;

    console.log("Creating NFT Token...");
    const nftCreate = new TokenCreateTransaction()
        .setTokenName("Diploma")
        .setTokenSymbol("GRAD")
        .setTokenType(TokenType.NonFungibleUnique)
        .setDecimals(0)
        .setInitialSupply(0)
        .setTreasuryAccountId(operatorId)
        .setSupplyType(TokenSupplyType.Finite)
        .setMaxSupply(250)
        .setSupplyKey(supplyKey)
        .freezeWith(client);

    const nftCreateRx = await executeTransaction(nftCreate, treasuryKey, client);
    const tokenId = nftCreateRx.tokenId;
    console.log(`NFT Token created with ID: ${tokenId}`);

    // IPFS metadata CIDs
    const CID = [
        Buffer.from("ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json"),
        Buffer.from("ipfs://bafyreic463uarchq4mlufp7pvfkfut7zeqsqmn3b2x3jjxwcjqx6b5pk7q/metadata.json"),
        Buffer.from("ipfs://bafyreihhja55q6h2rijscl3gra7a3ntiroyglz45z5wlyxdzs6kjh2dinu/metadata.json"),
        Buffer.from("ipfs://bafyreidb23oehkttjbff3gdi4vz7mjijcxjyxadwg32pngod4huozcwphu/metadata.json"),
        Buffer.from("ipfs://bafyreie7ftl6erd5etz5gscfwfiwjmht3b52cevdrf7hjwxx5ddns7zneu/metadata.json")
    ];

    console.log("Minting NFTs in batches...");
    await mintNFTBatch(tokenId, CID, supplyKey, client);
    console.log("NFT minting complete.");

    // Associate NFT with Alice
    const aliceId = AccountId.fromString(process.env.ALICE_ACCOUNT_ID);
    const aliceKey = PrivateKey.fromStringED25519(process.env.ALICE_PRIVATE_KEY);

    console.log("Associating NFT with Alice's account...");
    const associateAliceTx = await new TokenAssociateTransaction()
        .setAccountId(aliceId)
        .setTokenIds([tokenId])
        .freezeWith(client)
        .sign(aliceKey);
    const associateAliceRx = await associateAliceTx.execute(client);
    const associateReceipt = await associateAliceRx.getReceipt(client);
    console.log(`NFT association with Alice's account: ${associateReceipt.status} ✅`);

    // Check balances before transfer
    let balanceCheckTx = await new AccountBalanceQuery().setAccountId(operatorId).execute(client);
    console.log(`- Treasury balance for ${tokenId.toString()}: ${balanceCheckTx.tokens.get(tokenId) ?? 0}`);

    balanceCheckTx = await new AccountBalanceQuery().setAccountId(aliceId).execute(client);
    console.log(`- Alice's balance for ${tokenId.toString()}: ${balanceCheckTx.tokens.get(tokenId) ?? 0}`);

    // Transfer NFT from treasury to Alice
    const tokenTransferTx = await new TransferTransaction()
        .addNftTransfer(tokenId, 1, operatorId, aliceId)
        .freezeWith(client)
        .sign(treasuryKey);
    const tokenTransferSubmit = await tokenTransferTx.execute(client);
    const tokenTransferRx = await tokenTransferSubmit.getReceipt(client);
    console.log(`\nNFT transfer from treasury to Alice: ${tokenTransferRx.status} ✅`);

    // Check balances after transfer
    balanceCheckTx = await new AccountBalanceQuery().setAccountId(operatorId).execute(client);
    console.log(`- Treasury balance for ${tokenId.toString()}: ${balanceCheckTx.tokens.get(tokenId) ?? 0}`);

    balanceCheckTx = await new AccountBalanceQuery().setAccountId(aliceId).execute(client);
    console.log(`- Alice's balance for ${tokenId.toString()}: ${balanceCheckTx.tokens.get(tokenId) ?? 0}\n`);
}

main().then(() => console.log("NFT script completed successfully.")).catch(err => console.error(err));
