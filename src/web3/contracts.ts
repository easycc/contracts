import { createAlchemyWeb3 } from "@alch/alchemy-web3";
import Decimal from "decimal.js-light";
import { fromWei, toWei } from "web3-utils";

import FarmABI from "../../contracts/abis/Farm.json";
import TokenABI from "../../contracts/abis/Token.json";
import InventoryABI from "../../contracts/abis/Inventory.json";
import SunflowerFarmersABI from "../../contracts/abis/SunflowerFarmers.json";

import {
  GameState,
  Inventory,
  InventoryItemName,
} from "../domain/game/types/game";
import { IDS, KNOWN_IDS } from "../domain/game/types";

import { getItemUnit } from "./utils";

const alchemyKey = process.env.ALCHEMY_KEY;
const network = process.env.NETWORK;

const sunflowerLandWeb3 = createAlchemyWeb3(
  `https://polygon-${network}.g.alchemy.com/v2/${alchemyKey}`
);

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const FARM_ADDRESS = process.env.FARM_ADDRESS;
const INVENTORY_ADDRESS = process.env.INVENTORY_ADDRESS;

type Options = {
  sender: string;
  farmId: number;
};

export async function loadNFTFarm(id: number) {
  const farmContract = new sunflowerLandWeb3.eth.Contract(
    FarmABI as any,
    FARM_ADDRESS
  );
  const farmNFT: { owner: string; account: string } = await farmContract.methods
    .getFarm(id)
    .call();

  return farmNFT;
}

/**
 * Convert an onchain inventory into the supported game inventory
 * Returned as wei - ['0', '0', '0' ]
 */
export function makeInventory(amounts: string[]): Inventory {
  const inventoryItems = Object.keys(KNOWN_IDS) as InventoryItemName[];

  const inventory = amounts.reduce((items, amount, index) => {
    const name = inventoryItems[index];
    const unit = getItemUnit(name);
    const value = new Decimal(fromWei(amount, unit));

    return {
      ...items,
      [name]: value,
    };
  }, {} as Inventory);

  return inventory;
}

export async function fetchOnChainData({
  sender,
  farmId,
}: Options): Promise<GameState> {
  const farmNFT = await loadNFTFarm(farmId);

  if (farmNFT.owner !== sender) {
    throw new Error("Farm is not owned by you");
  }

  const tokenContract = new sunflowerLandWeb3.eth.Contract(
    TokenABI as any,
    TOKEN_ADDRESS
  );

  const balanceString = await tokenContract.methods
    .balanceOf(farmNFT.account)
    .call();
  const balance = new Decimal(fromWei(balanceString, "ether"));

  const inventoryContract = new sunflowerLandWeb3.eth.Contract(
    InventoryABI as any,
    INVENTORY_ADDRESS
  );

  const addresses = IDS.map(() => farmNFT.account);

  // TODO loop through all tokens and get the balances
  const inventory = await inventoryContract.methods
    .balanceOfBatch(addresses, IDS)
    .call();

  const friendlyInventory = makeInventory(inventory);

  return {
    balance,
    inventory: friendlyInventory,
    id: farmId,
    address: farmNFT.account,
    fields: {},
  } as GameState;
}

const sunflowerFarmersWeb3 = createAlchemyWeb3(
  `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`
);

const SFF_TOKEN_ADDRESS = "0xdf9B4b57865B403e08c85568442f95c26b7896b0";
const SFF_FARM_ADDRESS = "0x6e5Fa679211d7F6b54e14E187D34bA547c5d3fe0";

/**
 * Random block chosen
 * (Jan-28-2022 02:00:44 AM +UTC)
 * Gives leeway for people who accidentally exchanged tokens
 * Also gave time for people to withdraw LP
 */
const BLOCK_NUMBER = 24247919;

export async function loadV1Balance(address: string): Promise<string> {
  const tokenContract = new sunflowerFarmersWeb3.eth.Contract(
    // Use other ABI as it is also a ERC20 token
    TokenABI as any,
    SFF_TOKEN_ADDRESS
  );
  console.log("INITIED###");

  const balance = await tokenContract.methods
    .balanceOf(address)
    .call({ blockNumber: BLOCK_NUMBER }, BLOCK_NUMBER);
  console.log({ balance });
  return balance;
}

export enum V1Fruit {
  None = "0",
  Sunflower = "1",
  Potato = "2",
  Pumpkin = "3",
  Beetroot = "4",
  Cauliflower = "5",
  Parsnip = "6",
  Radish = "7",
}

export interface Square {
  fruit: V1Fruit;
  createdAt: number;
}

export async function loadV1Farm(address: string): Promise<Square[]> {
  const farmContract = new sunflowerFarmersWeb3.eth.Contract(
    SunflowerFarmersABI as any,
    SFF_FARM_ADDRESS
  );

  const fields = await farmContract.methods
    .getLand(address)
    .call({ blockNumber: BLOCK_NUMBER }, BLOCK_NUMBER);

  return fields;
}
