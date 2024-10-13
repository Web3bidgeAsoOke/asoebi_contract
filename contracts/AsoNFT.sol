// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract AsoNFT is ERC721URIStorage {
    struct Design {
        string ipfsHash;
        address designer;
        uint pricePerYard;
        uint totalYards;
        uint availableYards;
    }

    mapping(uint => Design) public designs;
    mapping(uint => bool) public isListed;
    uint public nextTokenId;
    address public owner;

    event DesignCreated(uint indexed designId, address indexed designer, string ipfsHash, uint pricePerYard, uint totalYards);
    
    event DesignListed(uint indexed designId, uint pricePerYard);
    
    event NFTMinted(uint indexed tokenId, uint indexed designId, address indexed buyer, uint yardsPurchased);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    modifier onlyDesigner(uint designId) {
        require(designs[designId].designer == msg.sender, "Not the designer");
        _;
    }

    constructor() ERC721("AsoEbiNFT", "AENFT") {
        owner = msg.sender;
        nextTokenId = 1; 
    }

    function createDesign(uint designId, string memory ipfsHash, uint pricePerYard,uint totalYards) external onlyOwner {
        require(pricePerYard > 0, "Price per yard must be greater than zero");
        require(totalYards > 0, "Total yards must be greater than zero");
        require(bytes(ipfsHash).length > 0, "IPFS hash is required");

        designs[designId] = Design({
            ipfsHash: ipfsHash,
            designer: msg.sender,
            pricePerYard: pricePerYard,
            totalYards: totalYards,
            availableYards: totalYards
        });

        emit DesignCreated(designId, msg.sender, ipfsHash, pricePerYard, totalYards);
    }

    // List a design for sale by setting its price
    function listDesign(uint designId, uint newPricePerYard) external onlyDesigner(designId) {
        require(newPricePerYard > 0, "Price per yard must be greater than zero");
        designs[designId].pricePerYard = newPricePerYard;
        isListed[designId] = true;

        emit DesignListed(designId, newPricePerYard);
    }
       
    // Retrieve design details, including available yards and price per yard
    function getDesign(uint designId) external view returns (string memory ipfsHash, address designer, uint pricePerYard, uint totalYards, uint availableYards) {
        Design memory design = designs[designId];
        require(design.designer != address(0), "Design does not exist");
        return (
            design.ipfsHash,
            design.designer,
            design.pricePerYard,
            design.totalYards,
            design.availableYards
        );
    }

    // Mint NFTs (purchase specific number of yards)
    function mintNFT(uint designId, uint yardsToBuy) external payable {
        Design storage design = designs[designId];

        require(isListed[designId], "Design is not listed for sale");
        require(design.designer != address(0), "Design does not exist");
        require(design.availableYards >= yardsToBuy, "Not enough yards available");
        require(msg.value == design.pricePerYard * yardsToBuy, "Incorrect value sent");

        _safeMint(msg.sender, nextTokenId);
        _setTokenURI(nextTokenId, design.ipfsHash);

        design.availableYards -= yardsToBuy;

        emit NFTMinted(nextTokenId, designId, msg.sender, yardsToBuy);
        nextTokenId++;
    }


    // Withdraw funds from the contract
    function withdraw() external onlyOwner {
        uint balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner).transfer(balance);
    }

    // Transfer ownership to a new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is the zero address");
        
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
