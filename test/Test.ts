import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';

describe('Deployment Tests', function () {
  async function deployContractsFixture() {
    const [owner] = await hre.ethers.getSigners();

    // Deploy AcceptedTokens contract
    const AcceptedTokens = await hre.ethers.getContractFactory(
      'AcceptedTokens'
    );
    const acceptedTokens = await AcceptedTokens.deploy();

    // Deploy Escrow contract
    const feePercentage = 5;
    const Escrow = await hre.ethers.getContractFactory('Escrow');
    const escrow = await Escrow.deploy(feePercentage);

    // Deploy AsoEbiAuction contract
    const AsoEbiAuction = await hre.ethers.getContractFactory('AsoEbiAution');
    const asoEbiAuction = await AsoEbiAuction.deploy(escrow.getAddress());

    // Deploy OwnerShip contract
    const OwnerShip = await hre.ethers.getContractFactory('OwnerShip');
    const ownerShip = await OwnerShip.deploy();

    return {
      acceptedTokens,
      escrow,
      asoEbiAuction,
      ownerShip,
      owner,
      feePercentage,
    };
  }

  describe('Deployment', function () {
    it('Should deploy the AcceptedTokens contract and set the right owner', async function () {
      const { acceptedTokens, owner } = await loadFixture(
        deployContractsFixture
      );
      expect(await acceptedTokens.owner()).to.equal(owner.address);
    });

    it('Should deploy the Escrow contract and set the right fee percentage', async function () {
      const { escrow, feePercentage } = await loadFixture(
        deployContractsFixture
      );
      expect(await escrow.feePercentage()).to.equal(feePercentage);
    });

    // it('Should deploy the AsoEbiAuction contract and set the right escrow address', async function () {
    //   const { asoEbiAuction, escrow } = await loadFixture(
    //     deployContractsFixture
    //   );
    //   expect(await asoEbiAuction.escrowAddress()).to.equal(escrow.getAddress());
    // });

    it('Should deploy the OwnerShip contract and set the right owner', async function () {
      const { ownerShip, owner } = await loadFixture(deployContractsFixture);
      expect(await ownerShip.owner()).to.equal(owner.address);
    });
  });
});
