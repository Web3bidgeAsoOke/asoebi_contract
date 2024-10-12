import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';

describe('Deployment Tests', function () {
  async function deployContractsFixture() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

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
      otherAccount,
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
    //   const actualEscrowAddress = await asoEbiAuction.escrowAddress(); // Add await here
    //   expect(actualEscrowAddress).to.equal(escrow.getAddress());
    // });

    it('Should deploy the OwnerShip contract and set the right owner', async function () {
      const { ownerShip, owner } = await loadFixture(deployContractsFixture);
      expect(await ownerShip.owner()).to.equal(owner.address);
    });
  });

  describe('Ownership Management', function () {
    it('Should allow the current owner to propose a new owner', async function () {
      const { ownerShip, owner, otherAccount } = await loadFixture(
        deployContractsFixture
      );

      // Owner proposes a new owner
      await ownerShip.connect(owner).proposeNewOwner(otherAccount.address);

      expect(await ownerShip.newOwner()).to.equal(otherAccount.address);
    });

    it('Should revert if a non-owner tries to propose a new owner', async function () {
      const { ownerShip, otherAccount } = await loadFixture(
        deployContractsFixture
      );

      // Attempt to propose a new owner from a non-owner account
      await expect(
        ownerShip.connect(otherAccount).proposeNewOwner(otherAccount.address)
      ).to.be.revertedWithCustomError(ownerShip, 'NotOwner');
    });

    it('Should revert if the proposed new owner is the zero address', async function () {
      const { ownerShip, owner } = await loadFixture(deployContractsFixture);

      // Owner tries to propose the zero address as the new owner
      await expect(
        ownerShip.connect(owner).proposeNewOwner(hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(ownerShip, 'AddressZero_OwnerShip');
    });
  });
});
