// SPDX-License-Identifier: MIT

pragma solidity 0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IEscrow {
    function depositForAuction(
        address _nftAddress,
        uint256 _tokenId,
        address payable _seller,
        address _winner,
        uint256 _winningbid
    ) external payable;
    function depositForOrder(address seller, uint256 amount, address buyer) external payable ;
}
contract AsoEbiMarketPlace is ERC721("AsoEbiMarketPlace", "AEMP"), Ownable(msg.sender), ReentrancyGuard {
    // ===== ERROR ====
    error  NotANewUser(address );
    error  NotVaildLister();
    error  NotListed(  );
    error OrderDoesNotExist();
    error OrderDoesExist();
    error  Alreadylisted( );
    error NotItemOwner();
    error InvalidValue();
    error InvalidQuantity();
    error InvalidPrice();
    error InsufficientFunds();
    error NotListingOwner();
    error NotVaildBuyer();
    error WithdrawFailed( );
    

    event ItemListed(
        address indexed seller,
        uint256 tokenId,
        uint256 quantity,
         ListingType listingType,
          uint256 pricePerItem
    
    );

    event ItemUpdated(address indexed  seller, uint256 tokenId, uint256 price,uint256 quantity);
    event ItemCanceled(address indexed seller, uint256 tokenId);
    event OrderCreated(
        address indexed buyer,
        uint256 tokenId,
        uint256 quantity,
        OrderType orderType

    );
    event OrderAccepted(
          address indexed buyer,
        uint256 tokenId,
        uint256 quantity,
        OrderType orderType
    );
    event OrderCanceled(address indexed buyer, uint256 tokenId);

    enum RoleType {
        NotRegitered,
        FabricSeller,
        Designer,
        Buyer
    }

    enum OrderType {
        NotType,
        Fabric,
        ReadyToWear
    } enum ListingType {
          NotType,
        Fabric,
        ReadyToWear
    }
    enum OrderStatus {
        NotOrdered,
        Pending,
        Accepted
    }

    struct User {
        string displayName;
        RoleType roleType;
        bool isRegistered;
    }

    struct Listing {
       // uint256 quantity; // the amount of readytowears or farbic yards  avaliable for sale
       address owner; // seller/designer
        uint256 pricePerItem; // price per yard of fabric or price per ready to wear
        uint256 listingTime; 
        bool isListed;
        ListingType listingType;
        uint256 quantityLeft; // to know when item is soldout
    }

    struct Order {
        uint256 quantity;
        string shippingInfo; // weird should get a better way
        uint256 timeofOrder;
        OrderStatus orderStatus;
        OrderType orderType;
        uint256 totalPrice;
    }

IERC721 public nftAddress = IERC721(address(this));
address public escrowAddress;
    mapping(address => User) public users;
    // tokenid  -> Listing
    mapping(uint256 => Listing) public listings;
    // tokenid -> buyer -> Order
    mapping(uint256 => mapping(address => Order)) public orders;
      // Mapping from token ID to token URI
    mapping(uint256 => string) private _tokenURIs;

    modifier validLister {
        require(users[msg.sender].roleType == RoleType.FabricSeller || users[msg.sender].roleType == RoleType.Buyer , NotVaildLister()  );
        
        _;
    }
     modifier validBuyer {
        require(users[msg.sender].roleType == RoleType.Buyer , NotVaildBuyer()  );
        
        _;
    }



    modifier isListed( uint256 _tokenId, address _owner) {
        Listing memory listing = listings[_tokenId];
        require(listing.listingTime > 0, NotListed());
        require(listing.owner == _owner, NotListingOwner());
        _;
    }

    modifier validListing( uint256 _tokenId, address _owner) {
      Listing memory listing = listings[_tokenId];
        require(listing.isListed == false, Alreadylisted());
        _isOwner( _tokenId, _owner);

      
        _;
    }

    modifier orderExist( uint256 _tokenId, address _buyer) {
        Order memory order 
        = orders[_tokenId][_buyer];
        require(order.quantity > 0 && order.orderStatus == OrderStatus.Pending, OrderDoesNotExist());
        _;
    }

    modifier orderNotExists( uint256 _tokenId, address _buyer) {
        Order memory order = orders[_tokenId][_buyer];
        require(order.quantity == 0 || order.timeofOrder == 0,OrderDoesExist());
        _;
    }



    constructor(address _escrowAddress) {
        escrowAddress = _escrowAddress;
    }


    function registerUser(string memory _displayName,RoleType _roleType) external {
        require(users[msg.sender].isRegistered == false, NotANewUser(msg.sender));
        users[msg.sender] = User({
           displayName : _displayName,
            roleType : _roleType,
            isRegistered : true
        });
    }
    function listItem(uint256 _tokenId, uint256 _quantity, uint256 _pricePerItem) external validLister validListing(_tokenId, msg.sender) {
           require(_pricePerItem > 0, InvalidPrice());
        require(_quantity > 0, InvalidQuantity());

        nftAddress.safeTransferFrom(msg.sender, address(this), _tokenId);
        ListingType listingType ;
        if (users[msg.sender].roleType == RoleType.FabricSeller ) {
            listingType = ListingType.Fabric;
            listings[_tokenId] = Listing(msg.sender, _pricePerItem, _getTime(), true, listingType, _quantity);
        } else {
            listingType = ListingType.ReadyToWear;
                 listings[_tokenId] = Listing( msg.sender,_pricePerItem, _getTime(), true, listingType, _quantity);
        }
        
        emit ItemListed(msg.sender, _tokenId, _quantity, listingType, _pricePerItem);
    }


    
     function updateListing(uint256 _tokenId, uint256 _pricePerItem, uint256 _quantity) external validLister isListed(_tokenId,msg.sender) {
        require(_quantity > 0 || _pricePerItem > 0, InvalidValue());

        Listing storage listing = listings[_tokenId];
        listing.pricePerItem = _pricePerItem;
        listing.quantityLeft += _quantity;
        emit ItemUpdated(msg.sender, _tokenId, _pricePerItem, _quantity);
    }



    function cancelListing(uint256 _tokenId) external validLister isListed(_tokenId, msg.sender) {  
        delete ( listings[_tokenId]);
        nftAddress.safeTransferFrom(address(this), msg.sender, _tokenId);
        emit ItemCanceled(msg.sender, _tokenId);
    }


    function makeOrder(uint256 _tokenId, uint256 _quantity, string memory _shippingInfo) external payable validBuyer orderNotExists(_tokenId, msg.sender) {
        require(_quantity > 0, InvalidQuantity());

        _checkListing(_tokenId,_quantity);

        Listing storage listing = listings[_tokenId];

        require(listing.quantityLeft >= _quantity, InvalidQuantity());

        uint256 totalPrice = listing.pricePerItem * _quantity;

        require(msg.value >= totalPrice, InsufficientFunds());

        listing.quantityLeft -= _quantity;
        
        OrderType orderType ;
        if (listing.listingType == ListingType.Fabric){
            orderType = OrderType.Fabric;
        } else {
              orderType = OrderType.ReadyToWear;
        }

        orders[_tokenId][msg.sender] = Order({
            quantity: _quantity,
            shippingInfo: _shippingInfo,
            timeofOrder: block.timestamp,
            orderStatus: OrderStatus.Pending,
            orderType: orderType ,
            totalPrice : msg.value 
        });

        

        emit OrderCreated(msg.sender, _tokenId, _quantity, OrderType.Fabric);
    }

    function acceptOrder(uint256 _tokenId, address _buyer) external nonReentrant isListed(_tokenId, msg.sender) orderExist(_tokenId, _buyer) {
        Order storage order = orders[_tokenId][_buyer];
        order.orderStatus = OrderStatus.Accepted;
        Listing storage listing = listings[_tokenId];
        listing.quantityLeft -= order.quantity;
        // call escrow 
         IEscrow escrowContract = IEscrow(escrowAddress);

         escrowContract.depositForOrder{value : order.totalPrice }(msg.sender, order.totalPrice, _buyer);

        emit OrderAccepted(_buyer, _tokenId, order.quantity, order.orderType);
    }

    function cancelOrder(uint256 _tokenId) external nonReentrant orderExist(_tokenId, msg.sender) {

        Order memory order = orders[_tokenId][msg.sender];
        uint256 amount = order.totalPrice;
         delete orders[_tokenId][msg.sender];
         (bool success,) = msg.sender.call{value: amount}("");
         require(success , WithdrawFailed());
      
        emit OrderCanceled(msg.sender, _tokenId);
    }
// ======  Mint Function To Existed User=====

    function _exists(uint256 tokenId) internal view returns (bool) {
    return nftAddress.ownerOf(tokenId) != address(0);
    }

    function mint(uint256 tokenId, string memory uri) external validLister {
    // Check if the tokenId is already minted
    require(!_exists(tokenId), "Token already minted");

    // Mint the NFT
    _safeMint(msg.sender, tokenId);

    // Set the token URI for the newly minted token
    _setTokenURI(tokenId, uri);
    }

    // Internal function to set the token URI
    function _setTokenURI(uint256 tokenId, string memory uri) internal {
    require(_exists(tokenId), "URI set of nonexistent token");
    _tokenURIs[tokenId] = uri;
    }

    // Override the ERC721's tokenURI function
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
    return _tokenURIs[tokenId];
    }

    // ======  Owner's Function =====
    function updateEscrowAddress(address _escrowAddress) external onlyOwner {
        escrowAddress = _escrowAddress;
    }


    function _isOwner (uint _tokenId,address _owner) internal view {
        require(IERC721(address(this)).ownerOf(_tokenId) == _owner, NotItemOwner());
    }

     function _getTime() internal view  returns (uint256) {
        return block.timestamp;
    }

    function _checkListing(uint _tokenId, uint _quantity) internal view {
         Listing memory listing = listings[_tokenId];
        require(listing.listingTime > 0, NotListed());
         require(listing.owner != address(0) ,NotListed());
        require(listing.quantityLeft >= _quantity , InvalidQuantity());
    }
}
