// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

import "./interfaces/IMeritMintableNFT.sol";

contract MeritNFT is ERC721, AccessControlEnumerable, IMeritMintableNFT {

    error OnlyMinterError();

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    string internal baseTokenURI;

    modifier onlyMinter {
        if(!hasRole(MINTER_ROLE, msg.sender)) {
            revert OnlyMinterError();
        }
        _;
    }

    /// @notice Constructor
    /// @param _name The name of the NFT
    /// @param _symbol Symbol aka ticker
    /// @param _baseTokenURI Prepends the tokenId for the tokenURI
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseTokenURI
    ) ERC721(_name, _symbol) {
        baseTokenURI = _baseTokenURI;
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }


    /// @notice Mints an NFT. Can only be called by an address with the minter role and tokenId must be unique
    /// @param _tokenId Id of the token
    /// @param _receiver Address receiving the NFT
    function mint(uint256 _tokenId, address _receiver) external override onlyMinter {
        _mint(_receiver, _tokenId);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    /// @notice returns the baseURI
    /// @return The tokenURI
    function baseURI() external view returns (string memory) {
        return _baseURI();
    }

    /// @notice Signals support for a given interface
    /// @param interfaceId 4bytes signature of the interface
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlEnumerable, ERC721)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}