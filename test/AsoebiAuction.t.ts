import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { AsoEbiAution, MockERC721, MockEscrow } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('AsoEbiAution', function () {
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let bidder: SignerWithAddress;
  const BID_AMOUNT = ethers.parseEther('1.5');
  const TOKEN_ID = 1;
  const MINIMUM_SELLING_PRICE = ethers.parseEther('1');

  async function deployContractsFixture() {
    [owner, seller, buyer, bidder] = await ethers.getSigners();

    // Deploy MockERC721
    const MockERC721 = await ethers.getContractFactory('MockERC721');
    const mockNFT = await MockERC721.deploy('MockNFT', 'MNFT');

    // Deploy MockEscrow
    const MockEscrow = await ethers.getContractFactory('MockEscrow');
    const mockEscrow = await MockEscrow.deploy();

    // Deploy AsoEbiAution contract
    const AsoEbiAution = await ethers.getContractFactory('AsoEbiAution');
    const asoEbiAution = await AsoEbiAution.deploy(mockEscrow.target);

    // Setup contracts
    await mockEscrow.updateAuctionContract(asoEbiAution.target);
    await mockNFT.connect(seller).mint(TOKEN_ID);
    await mockNFT.connect(seller).approve(asoEbiAution.target, TOKEN_ID);

    return { asoEbiAution, mockNFT, mockEscrow, seller, bidder, buyer };
  }

  describe('createAuction', function () {
    it('should create an auction successfully', async function () {
      const { asoEbiAution, mockNFT, seller } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600; // 1 hour from now
      const endTime = startTime + 86400; // 24 hours after start time

      await expect(
        asoEbiAution.connect(seller).createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0, // AuctionType.Fabric
          true
        )
      )
        .to.emit(asoEbiAution, 'AuctionCreated')
        .withArgs(mockNFT.target, TOKEN_ID, 0);

      const auction = await asoEbiAution.getAuction(mockNFT.target, TOKEN_ID);
      expect(auction._owner).to.equal(seller.address);
      expect(auction.minimumSellingPrice).to.equal(MINIMUM_SELLING_PRICE);
    });

    it('should revert if not the NFT owner', async function () {
      const { asoEbiAution, mockNFT, buyer } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      await expect(
        asoEbiAution
          .connect(buyer)
          .createAuction(
            mockNFT.target,
            TOKEN_ID,
            MINIMUM_SELLING_PRICE,
            startTime,
            endTime,
            0,
            true
          )
      ).to.be.revertedWithCustomError(
        asoEbiAution,
        'CreateAuction_InvalidOwner'
      );
    });

    it('should revert if minimum selling price is zero', async function () {
      const { asoEbiAution, mockNFT, seller } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      await expect(
        asoEbiAution.connect(seller).createAuction(
          mockNFT.target,
          TOKEN_ID,
          0, // Invalid minimum selling price
          startTime,
          endTime,
          0, // AuctionType.Fabric
          true
        )
      ).to.be.revertedWithCustomError(
        asoEbiAution,
        'CreateAuction_InvalidSellingPrice'
      );
    });

    it('should revert if start time is in the past', async function () {
      const { asoEbiAution, mockNFT, seller } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) - 100; // Start time in the past
      const endTime = startTime + 86400;

      await expect(
        asoEbiAution
          .connect(seller)
          .createAuction(
            mockNFT.target,
            TOKEN_ID,
            MINIMUM_SELLING_PRICE,
            startTime,
            endTime,
            0,
            true
          )
      ).to.be.revertedWithCustomError(
        asoEbiAution,
        'CreateAuction_InvalidStartTime'
      );
    });

    it('should revert if end time is less than 10 minutes after start time', async function () {
      const { asoEbiAution, mockNFT, seller } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600; // 1 hour from now
      const endTime = startTime + 300; // 5 minutes from start time

      await expect(
        asoEbiAution
          .connect(seller)
          .createAuction(
            mockNFT.target,
            TOKEN_ID,
            MINIMUM_SELLING_PRICE,
            startTime,
            endTime,
            0,
            true
          )
      ).to.be.revertedWithCustomError(
        asoEbiAution,
        'CreateAuction_InvalidEndTime'
      );
    });
  });

  describe('placeBid', function () {
    it('should place a bid successfully after auction start time', async function () {
      const { asoEbiAution, mockNFT, seller, bidder } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600; // Auction starts in 1 hour
      const endTime = startTime + 86400; // 24-hour auction

      // Seller creates the auction
      await asoEbiAution
        .connect(seller)
        .createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0,
          true
        );

      // Move time past the start time
      await time.increase(3601); // Move 1 hour and 1 second ahead

      // Bidder places a bid
      await expect(
        asoEbiAution
          .connect(bidder)
          .placeBid(mockNFT.target, TOKEN_ID, { value: BID_AMOUNT })
      )
        .to.emit(asoEbiAution, 'BidPlaced')
        .withArgs(mockNFT.target, TOKEN_ID, bidder.address, BID_AMOUNT);

      // Verify that the highest bid was updated
      const highestBid = await asoEbiAution.getHighestBidder(
        mockNFT.target,
        TOKEN_ID
      );
      expect(highestBid._bidder).to.equal(bidder.address);
      expect(highestBid._bid).to.equal(BID_AMOUNT);
    });

    it('should revert if bid is lower than the minimum selling price', async function () {
      const { asoEbiAution, mockNFT, seller, bidder } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      // Seller creates the auction
      await asoEbiAution
        .connect(seller)
        .createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0,
          true
        );

      // Move time past the start time
      await time.increase(3601);

      // Place a low bid (less than minimum selling price)
      const lowBid = ethers.parseEther('0.5'); // Lower than the minimum selling price
      await expect(
        asoEbiAution
          .connect(bidder)
          .placeBid(mockNFT.target, TOKEN_ID, { value: lowBid })
      ).to.be.revertedWithCustomError(asoEbiAution, 'InvalidBid');
    });

    it('should revert if bid is lower than the current highest bid', async function () {
      const { asoEbiAution, mockNFT, seller, bidder } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      // Seller creates the auction
      await asoEbiAution
        .connect(seller)
        .createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0,
          true
        );

      // Move time past the start time
      await time.increase(3601);

      // Place the first valid bid
      const firstBid = ethers.parseEther('1.5');
      await asoEbiAution
        .connect(bidder)
        .placeBid(mockNFT.target, TOKEN_ID, { value: firstBid });

      // Place a lower bid than the first one
      const lowerBid = ethers.parseEther('1.2');
      await expect(
        asoEbiAution
          .connect(bidder)
          .placeBid(mockNFT.target, TOKEN_ID, { value: lowerBid })
      ).to.be.revertedWithCustomError(asoEbiAution, 'PlaceBid_DidNotOutBid');
    });

    it('should revert if auction is finalized', async function () {
      const { asoEbiAution, mockNFT, seller, bidder } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      // Seller creates the auction
      await asoEbiAution
        .connect(seller)
        .createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0,
          true
        );

      // Move time past the start time
      await time.increase(3601);

      // Place a valid bid
      await asoEbiAution
        .connect(bidder)
        .placeBid(mockNFT.target, TOKEN_ID, { value: BID_AMOUNT });

      // Move time past the end time
      await time.increase(86401);

      // Finalize the auction
      await asoEbiAution
        .connect(seller)
        .finalizeAuction(mockNFT.target, TOKEN_ID);

      // Try to place a bid after finalization (should revert)
      await expect(
        asoEbiAution
          .connect(bidder)
          .placeBid(mockNFT.target, TOKEN_ID, { value: BID_AMOUNT })
      ).to.be.revertedWithCustomError(
        asoEbiAution,
        'PlaceBid_AuctionAlreadyFinalized'
      );
    });

    it('should revert if auction is not active (before start time)', async function () {
      const { asoEbiAution, mockNFT, seller, bidder } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600; // Auction starts in 1 hour
      const endTime = startTime + 86400; // 24-hour auction

      // Seller creates the auction
      await asoEbiAution
        .connect(seller)
        .createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0,
          true
        );

      // Try to place a bid before the auction start time
      await expect(
        asoEbiAution
          .connect(bidder)
          .placeBid(mockNFT.target, TOKEN_ID, { value: BID_AMOUNT })
      ).to.be.revertedWithCustomError(asoEbiAution, 'PlaceBid_InvaildAuction');
    });

    it('should revert if auction is not active (after end time)', async function () {
      const { asoEbiAution, mockNFT, seller, bidder } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      // Seller creates the auction
      await asoEbiAution
        .connect(seller)
        .createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0,
          true
        );

      // Move time past the end time
      await time.increase(90000); // Move 25 hours ahead (auction has ended)

      // Try to place a bid after the auction has ended
      await expect(
        asoEbiAution
          .connect(bidder)
          .placeBid(mockNFT.target, TOKEN_ID, { value: BID_AMOUNT })
      ).to.be.revertedWithCustomError(asoEbiAution, 'PlaceBid_InvaildAuction');
    });
  });

  describe('finalizeAuction', function () {
    it('should finalize the auction successfully', async function () {
      const { asoEbiAution, mockNFT, seller, bidder } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      // Seller creates the auction
      await asoEbiAution
        .connect(seller)
        .createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0,
          true
        );

      // Move time past the start time
      await time.increase(3601);
      await asoEbiAution
        .connect(bidder)
        .placeBid(mockNFT.target, TOKEN_ID, { value: BID_AMOUNT });
      await time.increase(86401);

      await expect(
        asoEbiAution.connect(seller).finalizeAuction(mockNFT.target, TOKEN_ID)
      )
        .to.emit(asoEbiAution, 'AuctionFinalized')
        .withArgs(
          seller.address,
          mockNFT.target,
          TOKEN_ID,
          bidder.address,
          BID_AMOUNT
        );

      const auction = await asoEbiAution.getAuction(mockNFT.target, TOKEN_ID);
      expect(auction._finalized).to.be.true;
    });

    it('should revert if not the auction owner', async function () {
      const { asoEbiAution, mockNFT, buyer, seller } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      // Seller creates the auction
      await asoEbiAution
        .connect(seller)
        .createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0,
          true
        );

      await time.increase(3601);
      await expect(
        asoEbiAution.connect(buyer).finalizeAuction(mockNFT.target, TOKEN_ID)
      ).to.be.revertedWithCustomError(
        asoEbiAution,
        'CheckAuction_InvalidOwner'
      );
    });

    it('should revert if auction is still active', async function () {
      const { asoEbiAution, mockNFT, seller } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      // Seller creates the auction
      await asoEbiAution
        .connect(seller)
        .createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0,
          true
        );

      // Try to finalize before the auction has ended
      await time.increase(3601);
      await expect(
        asoEbiAution.connect(seller).finalizeAuction(mockNFT.target, TOKEN_ID)
      ).to.be.revertedWithCustomError(asoEbiAution, 'AuctionIsActive');
    });

    it('should revert if no bids placed', async function () {
      const { asoEbiAution, mockNFT, seller } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      // Seller creates the auction
      await asoEbiAution
        .connect(seller)
        .createAuction(
          mockNFT.target,
          TOKEN_ID,
          MINIMUM_SELLING_PRICE,
          startTime,
          endTime,
          0,
          true
        );

      // Move time past the end time
      await time.increaseTo(endTime + 1); // Ensure the end time has passed

      // Try to finalize without any bids placed
      await expect(
        asoEbiAution.connect(seller).finalizeAuction(mockNFT.target, TOKEN_ID)
      ).to.be.revertedWithCustomError(asoEbiAution, 'NoBid');
    });

    it('should revert if winning bid is below minimum selling price', async function () {
      const { asoEbiAution, mockNFT, seller, bidder } = await loadFixture(
        deployContractsFixture
      );

      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;

      // Seller creates the auction
      await asoEbiAution.connect(seller).createAuction(
        mockNFT.target,
        TOKEN_ID,
        MINIMUM_SELLING_PRICE,
        startTime,
        endTime,
        0,
        false // minimum bid is not set to the minimum selling price
      );

      // Move time past the start time
      await time.increase(3601);

      // Place a bid that meets the minimum bid but is lower than the minimum selling price
      const lowBid = ethers.parseEther('0.9');
      await asoEbiAution
        .connect(bidder)
        .placeBid(mockNFT.target, TOKEN_ID, { value: lowBid });

      // Move time past the end time
      await time.increaseTo(endTime + 1);

      // Try to finalize (should revert due to low winning bid)
      await expect(
        asoEbiAution.connect(seller).finalizeAuction(mockNFT.target, TOKEN_ID)
      ).to.be.revertedWithCustomError(asoEbiAution, 'InvalidWinningBid');
    });
  });
});
