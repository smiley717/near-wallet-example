import "regenerator-runtime/runtime";

import * as nearAPI from "near-api-js"
import getConfig from "./config"
import {
  AccessKey,
  AccessKeyPermission,
  CreateAccount, DeleteAccount, DeployContract, FunctionCall,
  FunctionCallPermission, Stake,
  Transfer
} from "near-api-js/src/transaction";
// import {functionCall} from "near-api-js/lib/transaction";
import { serialize } from "borsh";
// import {PublicKey} from "near-api-js/src/utils/key_pair";

const ONE_NEAR = "1000000000000000000000000";

class Assignable {
  constructor(properties) {
    Object.keys(properties).map((key) => {
      this[key] = properties[key];
    });
  }
}

class Enum {
  enum;

  constructor(properties) {
    if (Object.keys(properties).length !== 1) {
      throw new Error('Enum can only take single value');
    }
    Object.keys(properties).map((key) => {
      (this)[key] = properties[key];
      this.enum = key;
    });
  }
}

class Transaction extends Assignable {}
class Action extends Enum {}
class AddKey extends Assignable {}
class DeleteKey extends Assignable {}
class PublicKey extends Assignable {}
// class Transaction extends nearAPI.utils.enums.Assignable {}

const MIKE_TX_VAL = { kind: 'struct', fields: [
    ['signerId', 'string'],
    ['publicKey', PublicKey],
    ['nonce', 'u64'],
    ['receiverId', 'string'],
    ['blockHash', [32]],
    ['actions', [Action]]
  ]};

const MIKE_ACTION_VAL = {kind: 'enum', field: 'enum', values: [
    ['addKey', AddKey],
    ['deleteKey', DeleteKey],
  ]};

const MIKE_ADD_KEY_VAL = { kind: 'struct', fields: [
    ['publicKey', PublicKey],
    ['accessKey', AccessKey]
  ]};

const MIKE_DELETE_KEY_VAL = {kind: 'struct', fields: [
    ['publicKey', PublicKey],
    // ['deleteKey', {kind: 'struct', fields: [
    //     ['publicKey', {kind: 'struct', fields: [
    //         ['keyType', 'u8'],
    //         ['data', [32]]
    //       ]}]
    //   ]}
    // ],
  ]};

const MIKE_PK_VAL = { kind: 'struct', fields: [
    ['keyType', 'u8'],
    ['data', [32]]
  ]};
const MIKE_ACCESS_KEY_VAL = { kind: 'struct', fields: [
    ['nonce', 'u64'],
    ['permission', AccessKeyPermission],
  ]};

let MIKE_SCHEMA = new Map([
  [Action, {kind: 'enum', field: 'enum', values: [
      ['addKey', AddKey],
      ['deleteKey', DeleteKey],
    ]}],
  // [Transaction, { kind: 'struct', fields: [
  //     ['signerId', 'string'],
  //     ['publicKey', PublicKey],
  //     ['nonce', 'u64'],
  //     ['receiverId', 'string'],
  //     ['blockHash', [32]],
  //     ['actions', [Action]]
  //   ]}],
  [AddKey, { kind: 'struct', fields: [
      ['publicKey', PublicKey],
      ['accessKey', AccessKey]
    ]}],
  [DeleteKey, {kind: 'struct', fields: [
      ['deleteKey', {kind: 'struct', fields: [
        ['publicKey', {kind: 'struct', fields: [
            ['keyType', 'u8'],
            ['data', [32]]
          ]}]
        ]}
      ],
    ]}
  ],
  [PublicKey, { kind: 'struct', fields: [
      ['keyType', 'u8'],
      ['data', [32]]
    ]}],
  [AccessKey, { kind: 'struct', fields: [
      ['nonce', 'u64'],
      ['permission', AccessKeyPermission],
    ]}],
]);
let MIKE_SCHEMA_MAP = new Map();
const MIKE_SCHEMA_VAL = { kind: 'struct', fields: [
      ['signerId', 'string'],
      ['publicKey', { kind: 'struct', fields: [
          ['keyType', 'u8'],
          ['data', [32]]
        ]}],
      ['nonce', 'u64'],
      ['receiverId', 'string'],
      ['blockHash', [32]],
      ['actions',
        [
      //   ['deleteKey', {kind: 'struct', fields: [
      //       ['deleteKey', {kind: 'struct', fields: [
      //           ['publicKey', {kind: 'struct', fields: [
      //               ['keyType', 'u8'],
      //               ['data', [32]]
      //             ]}]
      //         ]}
      //       ],
      //     ]}
      //   ],
      //   ['addKey', {kind: 'struct', fields: [
      //       ['publicKey', {kind: 'struct', fields: [
      //           ['keyType', 'u8'],
      //           ['data', [32]]
      //         ]}],
      //       ['accessKey', {kind: 'struct', fields: [
      //           ['nonce', 'u64'],
      //           ['permission', {kind: 'struct', fields: [
      //               ['functionCall', {kind: 'struct', fields: [
      //                   ['allowance', {kind: 'option', type: 'u128'}],
      //                   ['receiverId', 'string'],
      //                   ['methodNames', ['string']],
      //                 ]}]
      //             ]}],
      //         ]}]
      //     ]}
      //   ]
      ]
      ]
    ]};

window.nearConfig = getConfig(process.env.NODE_ENV || "development");

// Initializing contract
async function initContract() {
  // Initializing connection to the NEAR node.
  window.near = await nearAPI.connect(Object.assign({ deps: { keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore() } }, nearConfig));

  // Initializing Wallet based Account. It can work with NEAR TestNet wallet that
  // is hosted at https://testnet.wallet.near.org
  window.walletAccount = new nearAPI.WalletAccount(window.near);

  // Getting the Account ID. If unauthorized yet, it's just empty string.
  window.accountId = window.walletAccount.getAccountId();

  // Initializing our contract APIs by contract name and configuration.
  window.contract = await window.near.loadContract(nearConfig.contractName, {
    // NOTE: This configuration only needed while NEAR is still in development
    // View methods are read only. They don't modify the state, but usually return some value.
    viewMethods: ['whoSaidHi'],
    // Change methods can modify the state. But you don't receive the returned value when called.
    changeMethods: ['sayHi'],
    // Sender is the account ID to initialize transactions.
    sender: window.accountId,
  });
}

// Using initialized contract
async function doWork() {
  // Based on whether you've authorized, checking which flow we should go.
  if (!window.walletAccount.isSignedIn()) {
    signedOutFlow();
  } else {
    signedInFlow();
  }
}

// Function that initializes the signIn button using WalletAccount
function signedOutFlow() {
  // Displaying the signed out flow container.
  Array.from(document.querySelectorAll('.signed-out')).forEach(el => el.style.display = '');
  // Adding an event to a sign-in button.
  document.getElementById('sign-in').addEventListener('click', () => {
    window.walletAccount.requestSignIn(
      // The contract name that would be authorized to be called by the user's account.
      window.nearConfig.contractName,
      // This is the app name. It can be anything.
      'Who was the last person to say "Hi!"?',
      // We can also provide URLs to redirect on success and failure.
      // The current URL is used by default.
    );
  });
}

// Main function for the signed-in flow (already authorized by the wallet).
function signedInFlow() {
  console.log('aloha top of sign in flow');
  // let buf = nearAPI.utils.serialize.serialize(MIKE_SCHEMA, value);
  // console.log('aloha buf', buf);
  // Displaying the signed in flow container.
  Array.from(document.querySelectorAll('.signed-in')).forEach(el => el.style.display = '');

  // Displaying current account name.
  document.getElementById('account-id').innerText = window.accountId;

  // Adding an event to a say-hi button.
  document.getElementById('say-hi').addEventListener('click', () => {
    // We call say Hi and then update who said Hi last.
    window.contract.sayHi().then(updateWhoSaidHi);
  });

  // Adding an event to a increase-key-allowance button.
  document.getElementById('increase-key-allowance').addEventListener('click', () => {
    // Get public key from logged-in user
    const localStorageKey = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    console.log('aloha localStorageKey', localStorageKey);
    // console.log('aloha window.nearConfig.networkId', window.nearConfig.networkId);
    // console.log('aloha walletAccount.accountId', walletAccount.getAccountId());
    let publicKey;
    localStorageKey.getKey(window.nearConfig.networkId, window.accountId).then(k => {
      // console.log('aloha k', k);
      publicKey = k.getPublicKey();
      console.log('aloha pk', publicKey.toString());

      // let accessKey = nearAPI.transactions.functionCallAccessKey('window.accountId', ['sayHi'], ONE_NEAR);
      let accessKey = new AccessKey({
        nonce: 0,
        permission: new AccessKeyPermission({
          functionCall: new FunctionCallPermission(ONE_NEAR, nearConfig.contractName, ['sayHi'])
        })
      });
      // let accessKey = new AccessKey(
      //   0,
      //   new AccessKeyPermission(
      //     functionCall: new FunctionCallPermission(ONE_NEAR, nearConfig.contractName, ['sayHi'])
      //   )
      // );
      console.log('aloha accessKey', accessKey.nonce);
      // return;
      const actions = [
        nearAPI.transactions.deleteKey(k.getPublicKey()),
        nearAPI.transactions.addKey(k.getPublicKey(), accessKey),
      ];
      // let helperPk = k.getPublicKey();
      // const actions = [
      //   new DeleteKey({
      //     deleteKey: {
      //       publicKey: {
      //         keyType: helperPk.keyType,
      //         data: helperPk.data
      //       }
      //     }
      //   })
      //   // nearAPI.transactions.addKey(k.getPublicKey(), accessKey),
      // ];
      // using the previous snippet to pull the latest block hash
      near.connection.provider.status().then(res => {
        let blockHash = res.sync_info.latest_block_hash;
        let blockHeight = res.sync_info.latest_block_height;
        console.log('aloha hash', blockHash);
        console.log('aloha actions', actions);

        // not even a function
        // walletAccount.signAndSendTransaction(window.accountId, actions).then(res => {
        //   console.log('aloha res', res);
        // })

        // (receiverId: string, actions: Action[], localKey?: PublicKey)
        // walletAccount.accessKeyForTransaction(window.accountId, [nearAPI.transactions.AddKey], localStorageKey).then(accessKey => {
        //   console.log('aloha accessKey', accessKey);
        //

        window.DEFAULT_SCHEMA = nearAPI.transactions.SCHEMA;


        const tx = nearAPI.transactions.createTransaction(
          window.accountId,
          publicKey,
          nearConfig.contractName,
          blockHeight * 1000000 + 1,
          actions,
          nearAPI.utils.serialize.base_decode(blockHash)
        );
        console.log('aloha tx', tx);
        window.himike0 = tx.actions[0];
        window.himike1 = tx.actions[1];

        MIKE_SCHEMA_MAP.set(tx.constructor, MIKE_TX_VAL);
        MIKE_SCHEMA_MAP.set(tx.publicKey.constructor, MIKE_PK_VAL);
        // MIKE_SCHEMA_MAP.set(tx.actions[0].constructor, MIKE_ACTION_VAL);
        MIKE_SCHEMA_MAP.set(tx.actions[0].constructor, MIKE_DELETE_KEY_VAL);
        MIKE_SCHEMA_MAP.set(tx.actions[0].deleteKey.constructor, MIKE_PK_VAL);
        MIKE_SCHEMA_MAP.set(tx.actions[1].constructor, MIKE_ADD_KEY_VAL);
        console.log('aloha tx.actions[0]', tx.actions[0]);
        MIKE_SCHEMA_MAP.set(tx.actions[1].addKey.accessKey.constructor, MIKE_ACCESS_KEY_VAL);
        MIKE_SCHEMA_MAP.set(tx.actions[1].addKey.publicKey.constructor, MIKE_PK_VAL);
        console.log('aloha tx.actions[1]', tx.actions[1]);
        // MIKE_SCHEMA_MAP.set(tx.constructor, MIKE_TX_VAL);
        // MIKE_SCHEMA_MAP.set(tx.constructor, MIKE_TX_VAL);

        // logic taken from requestSignTransactions
        let borshSerialized = serialize(MIKE_SCHEMA_MAP, tx);
        console.log('aloha borshSerialized', borshSerialized);
        // return;

        // MIKE_SCHEMA_MAP.set(tx.constructor, MIKE_SCHEMA_VAL);

        window.MIKE_SCHEMA = MIKE_SCHEMA;
        window.tx = tx;
        // const structSchema = MIKE_SCHEMA.get(tx.constructor.name);
        // if (!structSchema) {
        //   console.warn(`zzzClass ${tx.constructor.name} is missing in schema`);
        // } else {
        //   console.log('aloha structSchema', structSchema);
        // }

        const currentUrl = new URL(window.location.href);
        const newUrl = new URL('sign', nearConfig.walletUrl);
        newUrl.searchParams.set('transactions', [tx]
          // .map(transaction => serialize(nearAPI.transactions.SCHEMA, transaction))
          .map(transaction => serialize(MIKE_SCHEMA_MAP, transaction))
          .map(serialized => Buffer.from(serialized).toString('base64'))
          .join(','));
        newUrl.searchParams.set('callbackUrl', currentUrl.href);
        console.log('aloha newUrl.toString()', newUrl.toString());
        // window.location.assign(newUrl.toString());
        // return;

        // window.walletAccount.requestSignTransactions(
        //   [tx],
        //   window.location.origin
        // ).then(() => {
        //   console.log('aloha done');
        // });

        // window.walletAccount.requestSignTransactions({
        //   transactions: [tx],
        //   callbackUrl: window.location.origin,
        //   meta: 'increased-allowance'
        // }).then(() => {
        //   console.log('aloha done');
        // });
      });
        // });

      // })

    });
  });

  // Adding an event to a sing-out button.
  document.getElementById('sign-out').addEventListener('click', e => {
    e.preventDefault();
    walletAccount.signOut();
    // Forcing redirect.
    window.location.replace(window.location.origin + window.location.pathname);
  });

  // fetch who last said hi without requiring button click
  // but wait a second so the question is legible
  setTimeout(updateWhoSaidHi, 1000);
}

// Function to update who said hi
function updateWhoSaidHi() {
  // JavaScript tip:
  // This is another example of how to use promises. Since this function is not async,
  // we can't await for `contract.whoSaidHi()`, instead we attaching a callback function
  // using `.then()`.
  contract.whoSaidHi().then((who) => {
    const el = document.getElementById('who');
    el.innerText = who || 'No one';

    // only link to profile if there's a profile to link to
    if (who) {
      el.href = 'https://explorer.testnet.near.org/accounts/' + who;
    }

    // change the ? to a !
    const parent = el.parentNode;
    parent.innerHTML = parent.innerHTML.replace('?', '!');
  });
}

// Loads nearAPI and this contract into window scope.
window.nearInitPromise = initContract()
  .then(doWork)
  .catch(console.error);
