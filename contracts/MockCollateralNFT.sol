// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract MockCollateralNFT is ERC721Enumerable {
    // solhint-disable-next-line no-empty-blocks
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    function mint(uint256 _tokenId, address _receiver) external {
        _mint(_receiver, _tokenId);
    }
}
