// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './Dex.sol';

struct CallbackData {
  Dex dex;
  address tokenIn;
  address tokenOut;
  address payer;
}

abstract contract SwapCallback is DexPoolMapping {
  function swapCallbackInner(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) internal {
    require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
    CallbackData memory data = abi.decode(_data, (CallbackData));
    (address tokenIn, address tokenOut, Dex dex) = (data.tokenIn, data.tokenOut, data.dex);
    require(msg.sender == getPoolSafe(dex, tokenIn, tokenOut));

    (bool isExactInput, uint256 amountToPay) = amount0Delta > 0
      ? (tokenIn < tokenOut, uint256(amount0Delta))
      : (tokenOut < tokenIn, uint256(amount1Delta));
    if (isExactInput) {
      TransferHelper.safeTransferFrom(tokenIn, data.payer, msg.sender, amountToPay);
    } else {
      TransferHelper.safeTransferFrom(tokenOut, data.payer, msg.sender, amountToPay);
    }
  }
}
