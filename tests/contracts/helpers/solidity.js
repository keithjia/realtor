const fs = require("fs");
const path = require("path");
const ganache = require("ganache");
const solc = require("solc");
const { ethers } = require("ethers");

const CONTRACTS_DIR = path.resolve(__dirname, "../../../contracts");

let compiledContracts;

const getSource = (fileName) =>
  fs.readFileSync(path.join(CONTRACTS_DIR, fileName), "utf8");

const compileContracts = () => {
  if (compiledContracts) {
    return compiledContracts;
  }

  const input = {
    language: "Solidity",
    sources: {
      "HomeTransaction.sol": { content: getSource("HomeTransaction.sol") },
      "Factory.sol": { content: getSource("Factory.sol") },
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const fatalErrors = output.errors.filter((entry) => entry.severity === "error");
    if (fatalErrors.length) {
      throw new Error(fatalErrors.map((entry) => entry.formattedMessage).join("\n"));
    }
  }

  compiledContracts = output.contracts;
  return compiledContracts;
};

const getArtifact = (fileName, contractName) => {
  const contracts = compileContracts();
  const artifact = contracts[fileName] && contracts[fileName][contractName];

  if (!artifact) {
    throw new Error(`Unable to find artifact for ${fileName}:${contractName}`);
  }

  return artifact;
};

const createProvider = () =>
  new ethers.providers.Web3Provider(
    ganache.provider({
      logging: { quiet: true },
      wallet: { totalAccounts: 10 },
    })
  );

const getWallets = async (provider) => {
  const accounts = await provider.listAccounts();
  return accounts.map((account) => provider.getSigner(account));
};

const deployContract = async ({ fileName, contractName, signer, args = [] }) => {
  const artifact = getArtifact(fileName, contractName);
  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.evm.bytecode.object,
    signer
  );

  const contract = await factory.deploy(...args);
  await contract.deployed();
  return contract;
};

module.exports = {
  createProvider,
  deployContract,
  getArtifact,
  getWallets,
};
