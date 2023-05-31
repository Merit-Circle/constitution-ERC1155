// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./Constitution.sol";

contract NotEOA {

    constructor(
        address _constitution,
        bool _call
    ) {
        Constitution constitution = Constitution(_constitution);
        if(_call) {
            constitution.mint();
        }
    }

    function mintConstitution(address _constitution) public {
        Constitution constitution = Constitution(_constitution);
        constitution.mint();
    }
}
