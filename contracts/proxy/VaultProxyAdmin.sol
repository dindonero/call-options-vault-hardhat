//SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

contract VaultProxyAdmin is ProxyAdmin {
    constructor(
        address /* owner */
    ) ProxyAdmin() {}
}
