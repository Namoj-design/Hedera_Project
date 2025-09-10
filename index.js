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

    // Explicitly parse the account ID and private key
    const operatorId = AccountId.fromString(myAccountId);
    const operatorKey = PrivateKey.fromStringED25519(myPrivateKey);

    // Create client
    const client = Client.forTestnet().setOperator(operatorId, operatorKey);

    client.setDefaultMaxTransactionFee(new Hbar(100));
    client.setMaxQueryPayment(new Hbar(50));

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

    console.log("✅ New account created: " + newAccountId.toString());

    // Query balance
    const accountBalance = await new AccountBalanceQuery()
        .setAccountId(newAccountId)
        .execute(client);

    console.log(
        "💰 New account balance: " +
            accountBalance.hbars.toTinybars() +
            " tinybars."
    );

    return { client, newAccountId, newAccountPrivateKey };
}

environmentSetup()
    .then(() => console.log("Setup complete"))
    .catch((err) => console.error("Error during setup:", err));