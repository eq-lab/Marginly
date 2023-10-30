import {expect} from 'chai';
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
import {ethers} from 'hardhat';
import {SwapRouterMock, MintableToken, UniswapV3PoolMock, WETH9} from "../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    numberToFp,
    priceToPriceFp27,
    priceToSqrtPriceX96,
    sortUniswapPoolTokens,
} from '@marginly/common/math';

async function createToken(name: string, symbol: string, decimals: number = 18): Promise<MintableToken> {
    const factory = await ethers.getContractFactory('MintableToken');
    return await factory.deploy(name, symbol, decimals);
}

async function createWeth9(): Promise<WETH9> {
    const factory = await ethers.getContractFactory('WETH9');
    return await factory.deploy();
}

async function createUniswapV3PoolMock(oracle: string, tokenA: string, tokenB: string, fee: number): Promise<UniswapV3PoolMock> {
    const factory = await ethers.getContractFactory('UniswapV3PoolMock');
    return await factory.deploy(oracle, tokenA, tokenB, fee);
}

async function createSwapRouterMock(weth: string): Promise<SwapRouterMock> {
    const factory = await ethers.getContractFactory('SwapRouterMock');
    return await factory.deploy(weth);
}

interface CreateContractResultTokens {
    arb: MintableToken,
    weth: WETH9
}

interface CreateContractsResult {
    router: SwapRouterMock,
    pool: UniswapV3PoolMock,
    tokens: CreateContractResultTokens,
    owner: SignerWithAddress,
    oracle: SignerWithAddress,
    user: SignerWithAddress,
    fee: number
}

async function createContracts(): Promise<CreateContractsResult> {
    const arbToken = await createToken('Arbitrum', 'ARB');
    const wethToken = await createWeth9();

    const fee = 500; // 0.05%

    const [owner, oracle, user] = await ethers.getSigners();

    const pool = await createUniswapV3PoolMock(oracle.address, arbToken.address, wethToken.address, fee);

    const router = await createSwapRouterMock(wethToken.address);

    await router.setPool(arbToken.address, wethToken.address, fee, pool.address);

    return {
        router,
        pool,
        tokens: {
            arb: arbToken,
            weth: wethToken
        },
        owner,
        oracle,
        user,
        fee
    };
}

const createTokensGenerator = (tokens: CreateContractResultTokens, owner: SignerWithAddress) => async (tokenKey: keyof CreateContractResultTokens, address: string, amount: number) => {
    if (tokenKey === 'weth') {
        const token = tokens[tokenKey];
        const amountFp = numberToFp(18, amount);
        await token.connect(owner).deposit({value: amountFp});
        await token.connect(owner).transfer(address, amountFp);
    } else {
        const token = tokens[tokenKey];
        const decimals = await token.decimals();
        await token.connect(owner).mint(address, numberToFp(decimals, amount));
    }
};

async function setPrice(pool: UniswapV3PoolMock, oracle: SignerWithAddress, tokens: [MintableToken | WETH9, MintableToken | WETH9], price: number) {
    const [tokenA, tokenB] = tokens;
    const [token0, token1] = sortUniswapPoolTokens(
        [tokenA.address as `0x${string}`, tokenB.address as `0x${string}`],
        [
            {
                symbol: await tokenA.symbol(),
                address: tokenA.address,
                decimals: await tokenA.decimals(),
                price: price
            },
            {
                symbol: await tokenB.symbol(),
                address: tokenB.address,
                decimals: await tokenB.decimals(),
                price: 1 / price
            }
        ]
    );

    const priceFp27 = priceToPriceFp27(token0.price, token0.decimals, token1.decimals);
    const sqrtPriceX96 = priceToSqrtPriceX96(token0.price, token0.decimals, token1.decimals);

    await pool.connect(oracle).setPrice(priceFp27, sqrtPriceX96);
}

describe('SwapRouterMock', () => {
    const blockNumberInADistantFuture = 1000000000000000000000n;

    const arbEthPrice = 0.0005;

    const inTokenKey: keyof CreateContractResultTokens = 'weth';
    const outTokenKey: keyof CreateContractResultTokens = 'arb';

    interface SwapCase {
        exactSide: ExactSide;
        inAmount: number,
        inTokenKey: keyof CreateContractResultTokens;
        outAmount: number;
        outTokenKey: keyof CreateContractResultTokens;
    }

    const swapCases: SwapCase[] = [
        {
            exactSide: 'input',
            inAmount: 1,
            inTokenKey: 'weth',
            outAmount: 1999,
            outTokenKey: 'arb'
        },
        {
            exactSide: 'input',
            inAmount: 1,
            inTokenKey: 'arb',
            outAmount: 0.00049975,
            outTokenKey: 'weth'
        },
        {
            exactSide: 'output',
            inAmount: 1.00050025,
            inTokenKey: 'weth',
            outAmount: 2000,
            outTokenKey: 'arb'
        },
        {
            exactSide: 'output',
            inAmount: 2001.0005,
            inTokenKey: 'arb',
            outAmount: 1,
            outTokenKey: 'weth'
        }
    ];

    type ExactSide = 'input' | 'output';

    swapCases.forEach(({exactSide, inAmount, inTokenKey, outAmount, outTokenKey}) =>
        it(`should swap exact ${exactSide} of ${inTokenKey} correctly`, async () => {
            const {
                router,
                pool,
                tokens,
                owner,
                oracle,
                user,
                fee
            } = await loadFixture(createContracts);

            const {arb, weth} = tokens;
            await setPrice(pool, oracle, [arb, weth], arbEthPrice);

            const inToken = tokens[inTokenKey];
            const outToken = tokens[outTokenKey];

            const inDecimals = await inToken.decimals();
            const outDecimals = await outToken.decimals();

            const numToInTokenFp = (x: number) => numberToFp(inDecimals, x);
            const numToOutTokenFp = (x: number) => numberToFp(outDecimals, x);

            const generateTokens = createTokensGenerator(tokens, owner);

            await generateTokens(inTokenKey, user.address, 100 * inAmount);
            await generateTokens(outTokenKey, pool.address, 100 * outAmount);

            await inToken.connect(user).approve(router.address, numToInTokenFp(100 * inAmount));

            const amountInBefore = (await inToken.balanceOf(user.address)).toBigInt();
            const amountOutBefore = (await outToken.balanceOf(user.address)).toBigInt();

            const inAmountFp = numToInTokenFp(inAmount);
            const outAmountFp = numToOutTokenFp(outAmount);

            if (exactSide === 'input') {
                await router.connect(user).exactInputSingle({
                    tokenIn: inToken.address,
                    tokenOut: outToken.address,
                    fee,
                    recipient: user.address,
                    deadline: blockNumberInADistantFuture,
                    amountIn: inAmountFp,
                    amountOutMinimum: 0n,
                    sqrtPriceLimitX96: 0n
                });
            } else if (exactSide == 'output') {
                await router.connect(user).exactOutputSingle({
                    tokenIn: inToken.address,
                    tokenOut: outToken.address,
                    fee,
                    recipient: user.address,
                    deadline: blockNumberInADistantFuture,
                    amountOut: outAmountFp,
                    amountInMaximum: 100n * inAmountFp,
                    sqrtPriceLimitX96: 0n
                });
            } else {
                throw new Error('Unknown exact side');
            }

            const amountInAfter = (await inToken.balanceOf(user.address)).toBigInt();
            const amountOutAfter = (await outToken.balanceOf(user.address)).toBigInt();

            const actualInAmountFp = amountInBefore - amountInAfter;
            const actualOutAmountFp = amountOutAfter - amountOutBefore;

            const actualInAmountRelErr = Math.abs(Number(inAmountFp - actualInAmountFp)) / Number(inAmountFp);
            const actualOutAmountRelErr = Math.abs(Number(outAmountFp - actualOutAmountFp)) / Number(outAmountFp);

            console.log(`expected in amount: ${inAmountFp}, actual in amount: ${actualInAmountFp}, relative error: ${actualInAmountRelErr}`);
            console.log(`expected out amount: ${outAmountFp}, actual out amount: ${actualOutAmountFp}, relative error: ${actualOutAmountRelErr}`);

            expect(1e-9).to.be.greaterThanOrEqual(actualInAmountRelErr);
            expect(1e-9).to.be.greaterThanOrEqual(actualOutAmountRelErr);
        })
    );
});