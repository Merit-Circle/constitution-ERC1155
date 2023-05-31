// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./Constitution.sol";

contract NotEOA {

    constructor(
        address _constitution
    ) {
        Constitution constitution = Constitution(_constitution);
        constitution.mint();
    }
}
