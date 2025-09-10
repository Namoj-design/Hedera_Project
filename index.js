const {
    Client,
    AccountId,
    PrivateKey,
    AccountCreateTransaction,
    AccountBalanceQuery,
    Hbar,
    TransferTransaction,
} = require("@hashgraph/sdk");

require("dotenv").config();

async function environmentSetup() {
    // Grab operator ID and private key from .env
    const myAccountId = process.env.MY_ACCOUNT_ID;
    const myPrivateKey = process.env.MY_PRIVATE_KEY;

    if (!myAccountId || !myPrivateKey) {
        throw new Error(
            "Environment variables MY_ACCOUNT_ID and MY_PRIVATE_KEY must be present"
        );
    }

    // Explicitly parse account ID and private key
    const operatorId = AccountId.fromString(myAccountId);
    const operatorKey = PrivateKey.fromStringED25519(myPrivateKey);

    // Create client using explicit node map and robust settings
    const nodes = {
        "34.94.106.61:50212": new AccountId(3),
        "35.237.119.55:50212": new AccountId(4),
        "35.245.27.193:50212": new AccountId(5),
        "34.83.112.116:50212": new AccountId(6),
        "34.94.160.4:50212": new AccountId(7),
        "34.106.102.218:50212": new AccountId(8),
        "34.133.197.230:50212": new AccountId(9),
    };

    const client = Client.forNetwork(nodes).setOperator(operatorId, operatorKey);
    client.setMirrorNetwork(["https://testnet.mirrornode.hedera.com:443"]);
    client.setDefaultMaxTransactionFee(new Hbar(100));
    client.setMaxQueryPayment(new Hbar(50));
    client.setMaxAttempts(5);
    client.setRequestTimeout(120_000);

    // Generate new account keys
    const newAccountPrivateKey = PrivateKey.generateED25519();
    const newAccountPublicKey = newAccountPrivateKey.publicKey;

    // Create new account
    const newAccountTransactionResponse = await new AccountCreateTransaction()
        .setKey(newAccountPublicKey)
        .setInitialBalance(Hbar.fromTinybars(1000))
        .execute(client);

    const newAccountReceipt = await newAccountTransactionResponse.getReceipt(client);
    const newAccountId = newAccountReceipt.accountId;

    console.log("New account created: " + newAccountId.toString());

    // Query new account balance
    let newAccountBalance = await new AccountBalanceQuery()
        .setAccountId(newAccountId)
        .execute(client);

    console.log("New account balance: " + newAccountBalance.hbars.toTinybars() + " tinybars");

    // Transfer some Hbar from operator to new account
    console.log("Transferring 1000 tinybars from operator to new account...");

    const transferTx = await new TransferTransaction()
        .addHbarTransfer(operatorId, Hbar.fromTinybars(-1000)) // from operator
        .addHbarTransfer(newAccountId, Hbar.fromTinybars(1000)) // to new account
        .execute(client);

    await transferTx.getReceipt(client);

    console.log("Transfer complete.");

    // Query balances again
    const operatorBalance = await new AccountBalanceQuery()
        .setAccountId(operatorId)
        .execute(client);

    newAccountBalance = await new AccountBalanceQuery()
        .setAccountId(newAccountId)
        .execute(client);

    console.log("Operator balance: " + operatorBalance.hbars.toTinybars() + " tinybars");
    console.log("New account balance: " + newAccountBalance.hbars.toTinybars() + " tinybars");

    return { client, newAccountId, newAccountPrivateKey };
}

environmentSetup()
    .then(() => console.log("Setup complete"))
    .catch((err) => console.error("Error during setup:", err));