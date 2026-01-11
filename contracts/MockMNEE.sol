// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockMNEE
 * @dev A mock MNEE stablecoin for testing on Sepolia testnet.
 * For production, use the real MNEE at: 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
 */
contract MockMNEE is ERC20 {
    uint8 private constant _decimals = 6; // MNEE uses 6 decimals like USDC

    constructor() ERC20("Mock MNEE Stablecoin", "MNEE") {
        // Mint 10 million tokens to deployer for testing
        _mint(msg.sender, 10_000_000 * 10**_decimals);
    }

    function decimals() public pure override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Public mint function for testing purposes.
     * Anyone can mint tokens on testnet for testing.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @dev Faucet function - mint 1000 MNEE to caller.
     * Useful for testing without specifying amounts.
     */
    function faucet() external {
        _mint(msg.sender, 1000 * 10**_decimals);
    }
}
