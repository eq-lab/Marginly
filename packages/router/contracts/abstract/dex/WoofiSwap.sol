// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import '../Dex.sol';

abstract contract WooFiSwap is DexPoolMapping {
  function wooFiSwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    IWooPoolV2 wooPool = IWooPoolV2(getPoolSafe(dex, tokenIn, tokenOut));

    TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(wooPool), amountIn);
    amountOut = wooPool.swap(tokenIn, tokenOut, amountIn, minAmountOut, msg.sender, address(0));

    if (amountOut < minAmountOut) revert InsufficientAmount();
  }
}

interface IWooPoolV2 {
  function swap(
    address fromToken,
    address toToken,
    uint256 fromAmount,
    uint256 minToAmount,
    address to,
    address rebateTo
  ) external returns (uint256 realToAmount);
}
