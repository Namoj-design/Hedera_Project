console.clear();
import "dotenv/config";

import {
  Hbar,
  Client,
  AccountId,
  PrivateKey,
  AccountCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TransferTransaction,
  AccountBalanceQuery,
  TokenCreateTransaction,
  TokenAssociateTransaction,
} from "@hashgraph/sdk";

// Operator credentials
const operatorId = AccountId.fromString(process.env.OPERATOR_ID);

// flexible private key parser
function parsePriv(str) {
  try {
    return PrivateKey.fromStringECDSA(str);
  } catch {
    return PrivateKey.fromStringED25519(str);
  }
}
const operatorKey = parsePriv(process.env.OPERATOR_KEY);

async function main() {
  // Initialize client
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);
  client.setDefaultMaxTransactionFee(new Hbar(20));

  // Generate Treasury key
  const treasuryKey = PrivateKey.generateECDSA();
  const treasuryPublicKey = treasuryKey.publicKey;
  
  // Create Treasury account
  const treasuryTx = await new AccountCreateTransaction()
    .setECDSAKeyWithAlias(treasuryPublicKey)
    .setInitialBalance(new Hbar(20))
    .execute(client);
  const treasuryId = (await treasuryTx.getReceipt(client)).accountId;

  // Generate Alice's key
  const aliceKey = PrivateKey.generateECDSA();
  const alicePublicKey = aliceKey.publicKey;
  
  // Create Alice's account
  const aliceTx = await new AccountCreateTransaction()
    .setECDSAKeyWithAlias(alicePublicKey)
    .setInitialBalance(new Hbar(20))
    .execute(client);
  const aliceId = (await aliceTx.getReceipt(client)).accountId;

  // Generate supply key
  const supplyKey = PrivateKey.generateECDSA();

  // Create the NFT
  const nftCreate = new TokenCreateTransaction()
    .setTokenName("diploma")
    .setTokenSymbol("GRAD")
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryId)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(250)
    .setSupplyKey(supplyKey)
    .freezeWith(client);

  // Sign the transaction with the treasury key
  const nftCreateTxSign = await nftCreate.sign(treasuryKey);

  // Submit the transaction to a Hedera network
  const nftCreateSubmit = await nftCreateTxSign.execute(client);

  // Get the transaction receipt
  const nftCreateRx = await nftCreateSubmit.getReceipt(client);

  // Get the token ID
  const tokenId = nftCreateRx.tokenId;

  // Log the token ID
  console.log(`\nCreated NFT with token ID: ${tokenId}`);

  // IPFS content identifiers for which we will create a NFT
  const CID = [
    Buffer.from(
      "ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json"
    ),
    Buffer.from(
      "ipfs://bafyreic463uarchq4mlufp7pvfkfut7zeqsqmn3b2x3jjxwcjqx6b5pk7q/metadata.json"
    ),
    Buffer.from(
      "ipfs://bafyreihhja55q6h2rijscl3gra7a3ntiroyglz45z5wlyxdzs6kjh2dinu/metadata.json"
    ),
    Buffer.from(
      "ipfs://bafyreidb23oehkttjbff3gdi4vz7mjijcxjyxadwg32pngod4huozcwphu/metadata.json"
    ),
    Buffer.from(
      "ipfs://bafyreie7ftl6erd5etz5gscfwfiwjmht3b52cevdrf7hjwxx5ddns7zneu/metadata.json"
    ),
  ];

  // MINT NEW BATCH OF NFTs
  const mintTx = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata(CID) // up to 10 entries per tx
    .freezeWith(client);

  // Sign the transaction with the supply key
  const mintTxSign = await mintTx.sign(supplyKey);

  // Submit the transaction to a Hedera network
  const mintTxSubmit = await mintTxSign.execute(client);

  // Get the transaction receipt
  const mintRx = await mintTxSubmit.getReceipt(client);

  // Log the serial number
  console.log(
    `Created NFT ${tokenId} with serial number(s): ${mintRx.serials}\n`
  );

  // Create the associate transaction and sign with Alice's key
  const associateAliceTx = await new TokenAssociateTransaction()
    .setAccountId(aliceId)
    .setTokenIds([tokenId])
    .freezeWith(client)
    .sign(aliceKey);

  // Submit the transaction to a Hedera network
  const associateAliceTxSubmit = await associateAliceTx.execute(client);

  // Get the transaction receipt
  const associateAliceRx = await associateAliceTxSubmit.getReceipt(client);

  // Confirm the transaction was successful
  console.log(
    `NFT association with Alice's account: ${associateAliceRx.status} ✅`
  );

  // Check the balance before the NFT transfer for the treasury account
  let balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(treasuryId)
    .execute(client);
  console.log(
    `- Treasury balance for ${tokenId.toString()}: ${(
      balanceCheckTx.tokens.get(tokenId) ?? 0
    ).toString()}`
  );

  // Check the balance before the NFT transfer for Alice's account
  balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(aliceId)
    .execute(client);
  console.log(
    `- Alice's balance for ${tokenId.toString()}: ${(
      balanceCheckTx.tokens.get(tokenId) ?? 0
    ).toString()}`
  );

  // Transfer the NFT from treasury to Alice
  // Sign with the treasury key to authorize the transfer
  const tokenTransferTx = await new TransferTransaction()
    .addNftTransfer(tokenId, 1, treasuryId, aliceId)
    .freezeWith(client)
    .sign(treasuryKey);

  // Submit the transaction to a Hedera network
  const tokenTransferSubmit = await tokenTransferTx.execute(client);

  // Get the transaction receipt
  const tokenTransferRx = await tokenTransferSubmit.getReceipt(client);

  // Confirm the transaction was successful
  console.log(
    `\nNFT transfer from treasury to Alice: ${tokenTransferRx.status}  ✅`
  );

  // Check the balance for the treasury account after the transfer
  balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(treasuryId)
    .execute(client);
  console.log(
    `- Treasury balance for ${tokenId.toString()}: ${(
      balanceCheckTx.tokens.get(tokenId) ?? 0
    ).toString()}`
  );

  // Check the balance for Alice's account after the transfer
  balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(aliceId)
    .execute(client);
  console.log(
    `- Alice's balance for ${tokenId.toString()}: ${(
      balanceCheckTx.tokens.get(tokenId) ?? 0
    ).toString()}\n`
  );

  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});