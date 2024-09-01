import { ApiPromise, WsProvider } from "@polkadot/api";
import { MerkleTree } from "merkletreejs";
import * as crypto from "crypto-js";

interface BlockHeader {
  number: number;
  hash: string;
  parentHash: string;
  stateRoot: string;
  extrinsicsRoot: string;
}

async function apiInstance() {
  const provider = new WsProvider("wss://rpc.polkadot.io");
  const api = await ApiPromise.create({ provider });
  return api;
}

async function subscribeNewHeads(
  api: ApiPromise,
  callback: (header: BlockHeader) => void
) {
  await api.rpc.chain.subscribeNewHeads((lastHeader) => {
    const header: BlockHeader = {
      number: lastHeader.number.toNumber(),
      hash: lastHeader.hash.toHex(),
      parentHash: lastHeader.parentHash.toHex(),
      stateRoot: lastHeader.stateRoot.toHex(),
      extrinsicsRoot: lastHeader.extrinsicsRoot.toHex(),
    };
    callback(header);
  });
}

class HeaderStoreFactory {
  private headerMapByHash: Map<string, BlockHeader> = new Map();
  private headerMapByNumber: Map<number, BlockHeader> = new Map();

  addHeader(header: BlockHeader) {
    this.headerMapByHash.set(header.hash, header);
    this.headerMapByNumber.set(header.number, header);
  }

  getHeaderByHash(hash: string): BlockHeader | undefined {
    return this.headerMapByHash.get(hash);
  }

  getHeaderByNumber(number: number): BlockHeader | undefined {
    return this.headerMapByNumber.get(number);
  }
}

class MerkleFactory {
  public batchSize: number;
  public headers: BlockHeader[] = [];
  public merkleTrees: MerkleTree[] = [];

  constructor(batchSize: number) {
    this.batchSize = batchSize;
  }

  addHeader(header: BlockHeader) {
    this.headers.push(header);
    if (this.headers.length >= this.batchSize) {
      this.createMerkleTree();
      this.headers = [];
    }
  }

  private createMerkleTree() {
    const leaves = this.headers.map((h) => crypto.SHA256(h.hash));
    const tree = new MerkleTree(leaves, crypto.SHA256);
    this.merkleTrees.push(tree);
    console.log(
      "Merkle tree created with root:",
      tree.getRoot().toString("hex")
    );
  }

  getMerkleTree(index: number): MerkleTree | null {
    return this.merkleTrees[index] || null;
  }

  generateProof(header: BlockHeader): any[] {
    const leaf = Buffer.from(
      crypto.SHA256(header.hash).toString(crypto.enc.Hex),
      "hex"
    );

    const tree = this.merkleTrees.find(
      (tree) => tree.getLeafIndex(leaf) !== -1
    );

    if (!tree) return [];

    const proof = tree.getProof(leaf);
    return proof;
  }

  verifyProof(proof: any[], header: BlockHeader): boolean {
    const leaf = Buffer.from(
      crypto.SHA256(header.hash).toString(crypto.enc.Hex),
      "hex"
    );

    const tree = this.merkleTrees.find(
      (tree) => tree.getLeafIndex(leaf) !== -1
    );

    if (!tree) return false;

    const root = tree.getRoot();

    return tree.verify(proof, leaf, root);
  }
}

async function start() {
  const api = await apiInstance();
  const batchSize = 5; // Example batch size
  const merkleManager = new MerkleFactory(batchSize);
  const headerStore = new HeaderStoreFactory();

  subscribeNewHeads(api, (header) => {
    console.log("header", header);

    headerStore.addHeader(header);
    merkleManager.addHeader(header);
  });

  //   const headers = [
  //     {
  //       number: 22346172,
  //       hash: "0x883a4e71538a2978f0f78f250156d6955c289bcc8c9d94e3242f22d2abe1faa3",
  //       parentHash:
  //         "0x774daeb9ebb23a69b35dd959e6d9aa79e80f1122dfd02c19c25b6d56e0b8994f",
  //       stateRoot:
  //         "0x51f2e1ca355546864d54b26caf015b58c3621b2b5848e654d93a110e264fc5c9",
  //       extrinsicsRoot:
  //         "0x44869a1917c0483a7f5e5c79f440642afef10fb884a25d0044c71540969c1b75",
  //     },
  //     {
  //       number: 22346173,
  //       hash: "0x490789ed3dfd996480a576b62ae8a92de3fd2d2331285e6e60262e26fb7a2b33",
  //       parentHash:
  //         "0x883a4e71538a2978f0f78f250156d6955c289bcc8c9d94e3242f22d2abe1faa3",
  //       stateRoot:
  //         "0x5c43c2ae0ef1c8a6c7341421a02d2b2589e97fa2c276e131206f1af7aaa49cb4",
  //       extrinsicsRoot:
  //         "0x7bf90aeb49a08b406ab6e6ade0abbd68672b780768b244eef76b7182b4a7c087",
  //     },
  //     {
  //       number: 22346174,
  //       hash: "0x02e45b59fb975886a1ec3f90e5a55088cfff077d959509ec4137ff43d2fc1174",
  //       parentHash:
  //         "0x490789ed3dfd996480a576b62ae8a92de3fd2d2331285e6e60262e26fb7a2b33",
  //       stateRoot:
  //         "0xff8c477b69ab53329b8a1a31d7111f95a2989d760a32fb9c017c3a536939651a",
  //       extrinsicsRoot:
  //         "0xeb44633a7905d2f346ed9f6d8d348719110bd7b88f07b18d40637ff5bb0bfe14",
  //     },
  //     {
  //       number: 22346175,
  //       hash: "0xa8a09b3b6c10ecc811d9dab498a170340b77481067fe7a08f46b70576a14b68b",
  //       parentHash:
  //         "0x02e45b59fb975886a1ec3f90e5a55088cfff077d959509ec4137ff43d2fc1174",
  //       stateRoot:
  //         "0x3715f43934bd203224f0d149f67ab38577faf6c3afb0e2287e779820b5bf23c3",
  //       extrinsicsRoot:
  //         "0x268da97b98573c0f1d032ce424d0f28d60a3dc8b1257d93ce92d85d291df7928",
  //     },
  //     {
  //       number: 22346176,
  //       hash: "0x573ecf013462dc12b2da1a60b41148e03e59096c41da8de5c1d101a2e1d8cbbe",
  //       parentHash:
  //         "0xa8a09b3b6c10ecc811d9dab498a170340b77481067fe7a08f46b70576a14b68b",
  //       stateRoot:
  //         "0xd0dca1cce825b616600c862a344d861cb1c3c452327e03e59e829978433de530",
  //       extrinsicsRoot:
  //         "0x44e8184bd53387be34b734c1310d67e647d25c54a1d784e3922729a000b0b92e",
  //     },
  //   ];
  //   headers.forEach((header) => {
  //     merkleManager.addHeader(header);
  //   });
  //   const proof = merkleManager.generateProof(headers[1]);
  //   const verified = merkleManager.verifyProof(proof, headers[1]);
  //   console.log("verified", verified);
}

start();
