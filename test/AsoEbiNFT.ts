import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe("AsoEbiNFT", function () {
  let AsoEbiNFT: any;
  let asoEbiNFT: any;
  let owner: any;
  let addr1: any;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    AsoEbiNFT = await ethers.getContractFactory("AsoEbiNFT");
    asoEbiNFT = await AsoEbiNFT.deploy();
    await asoEbiNFT.deployed();
  });

  it("should allow a designer to create a design", async function () {
    const designId = 1;
    const ipfsHash = "QmTestHash";
    const price = ethers.parseEther("1.0"); // 1 ETH

    await expect(asoEbiNFT.connect(addr1).createDesign(designId, ipfsHash, price))
      .to.emit(asoEbiNFT, "DesignCreated")
      .withArgs(designId, addr1.address, ipfsHash, price);

    const design = await asoEbiNFT.getDesign(designId);
    expect(design[0]).to.equal(ipfsHash);
    expect(design[1]).to.equal(addr1.address);
    expect(design[2]).to.equal(price);
  });

  it("should revert if price is zero", async function () {
    const designId = 1;
    const ipfsHash = "QmTestHash";

    await expect(asoEbiNFT.createDesign(designId, ipfsHash, 0))
      .to.be.revertedWith("Price must be greater than zero");
  });

  it("should revert if IPFS hash is empty", async function () {
    const designId = 1;
    const price = ethers.parseEther("1.0");

    await expect(asoEbiNFT.createDesign(designId, "", price))
      .to.be.revertedWith("IPFS hash is required");
  });

  it("should return the correct design data", async function () {
    const designId = 2;
    const ipfsHash = "QmTestHash2";
    const price = ethers.parseEther("2.0"); 

    await asoEbiNFT.createDesign(designId, ipfsHash, price);

    const design = await asoEbiNFT.getDesign(designId);
    expect(design[0]).to.equal(ipfsHash);
    expect(design[1]).to.equal(owner.address);
    expect(design[2]).to.equal(price);
  });

  it("should revert if the design does not exist", async function () {
    await expect(asoEbiNFT.getDesign(999))
      .to.be.revertedWith("Design does not exist");
  });
});
