// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import './libraries/OracleLib.sol';

contract PriceAdapter {
  AggregatorV3Interface public immutable baseDataFeed;
  AggregatorV3Interface public immutable quoteDataFeed;

  constructor(address _baseDataFeed, address _quoteDataFeed) {
    require(_baseDataFeed != address(0));
    baseDataFeed = AggregatorV3Interface(_baseDataFeed);
    quoteDataFeed = AggregatorV3Interface(_quoteDataFeed);
  }

  
  /// @dev Returns IUniswapV3-compatible tick cumulatives produced from chainlink price.
  /// @param secondsAgos From how long ago each cumulative tick and liquidity value should be returned
  /// @return tickCumulatives Cumulative tick values as of each `secondsAgos` from the current block timestamp
  /// @return secondsPerLiquidityCumulativeX128s Cumulative seconds per liquidity-in-range value as of each `secondsAgos` from the current block
  /// timestamp
  function observe(
    uint32[] calldata secondsAgos
  )
    external
    view
    returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
  {
    secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);
    secondsPerLiquidityCumulativeX128s[0] = secondsAgos[0];
    secondsPerLiquidityCumulativeX128s[1] = secondsAgos[1];

    uint160 sqrtPriceX96 = getSqrtPriceX96();
    tickCumulatives = OracleLib.getCumulativeTickAtSqrtRatio(sqrtPriceX96, secondsAgos);
  }

  /// @dev Returns sqrt price as Q96
  function getSqrtPriceX96() public view returns (uint160) {
    (int256 basePrice, int256 quotePrice) = getScaledPrices();

    uint160 sqrtPriceX96 = uint160(
      OracleLib.sqrt(
          Math.mulDiv(uint256(basePrice), 1 << 192, uint256(quotePrice))
      )
    );

    return sqrtPriceX96;
  }

  /// @dev Returns base and quote prices scaled to max decimals of both
  function getScaledPrices() public
    view returns (int256, int256) {
      (, int256 basePrice, , , ) = baseDataFeed
            .latestRoundData();
      uint8 baseDecimals = baseDataFeed.decimals();
      if (address(quoteDataFeed) == address(0)) {
        return (basePrice, int256(10 ** uint256(baseDecimals)));
      }
      uint8 quoteDecimals = quoteDataFeed.decimals();
      uint8 decimals = baseDecimals > quoteDecimals ? baseDecimals : quoteDecimals;

      basePrice = scalePrice(basePrice, baseDecimals, decimals);

      (, int256 quotePrice, , , ) = quoteDataFeed
          .latestRoundData();
      quotePrice = scalePrice(quotePrice, quoteDecimals, decimals);

      return (basePrice, quotePrice);
  }

  function scalePrice(
        int256 _price,
        uint8 _priceDecimals,
        uint8 _decimals
    ) internal pure returns (int256) {
      return _price * int256(10 ** uint256(_decimals - _priceDecimals));
    }
}