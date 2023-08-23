// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../Dex.sol';
import '../UniswapV2LikeSwap.sol';

abstract contract SushiSwap is UniswapV2LikeSwap, DexPoolMapping {
  uint256 private constant SUSHI_SWAP_FEE = 997;

  function sushiSwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    address pool = getPoolSafe(dex, tokenIn, tokenOut);
    amountOut = uniswapV2LikeGetAmountOut(pool, amountIn, tokenIn, tokenOut, SUSHI_SWAP_FEE);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function sushiSwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    address pool = getPoolSafe(dex, tokenIn, tokenOut);
    amountIn = uniswapV2LikeGetAmountIn(pool, amountOut, tokenIn, tokenOut, SUSHI_SWAP_FEE);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }
}