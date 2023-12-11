const { getWeth, AMOUNT } = require("../scripts/getWeth");
const { getNamedAccounts } = require("hardhat");

async function main() {
  await getWeth();

  // const { deployer } = await getNamedAccounts();
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  // Lending pool address provider: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  // Lending Pool:

  const lendingPool = await getLendingPool(deployer);
  console.log(`LendingPool address: ${lendingPool.target}`);

  // deposit:
  const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  // approve
  await approveERC20(wethTokenAddress, lendingPool.target, AMOUNT, deployer);
  console.log("Depositing....");
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
  console.log("Deposited");

  // Borrow time
  let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(
    lendingPool,
    deployer
  );

  // get DAI price
  const daiPrice = await getDaiPrice(
    "0x773616E4d11A78F511299002da57A0a94577F1f4"
  );

  // daiPrice is in ETH, the next function changes it to DAI
  const amountDaiToBorrow =
    Number(availableBorrowsETH) * 0.95 * (1 / Number(daiPrice));

  console.log(`You can borrow ${amountDaiToBorrow} DAI`);
  const amountDaiToBorrowWei = ethers.parseEther(amountDaiToBorrow.toString());

  console.log(amountDaiToBorrowWei);

  // Borrowing from aave
  const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer);
  await getBorrowUserData(lendingPool, deployer);
}

// Borrow DAI
async function borrowDai(
  daiAddress,
  lendingPool,
  amountDaiToBorrowWei,
  account
) {
  console.log("In here");
  const borrowTx = await lendingPool.borrow(
    daiAddress,
    amountDaiToBorrowWei,
    2 /*I put 1 which is stable innitially and it was reverting with string "12" because stable wasn't enabled for DAI asset*/,
    0,
    account
  );
  console.log("Over here");
  await borrowTx.wait();
  console.log("Here");
  console.log("You have borrowed!");
}

// Get Dai price Feed
async function getDaiPrice(daiAddress) {
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    daiAddress
  );
  const price = (await daiEthPriceFeed.latestRoundData())[1];
  console.log(`The DAI/ETH price is ${price.toString()}`);

  return price;
}

// get User Borrow Data
async function getBorrowUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account);
  console.log(`You have ${totalCollateralETH} worth of ETH deposited`);
  console.log(`You have ${totalDebtETH} worth of ETH borrowed.`);
  console.log(`You can borrow ${availableBorrowsETH} worth of ETH`);
  return { availableBorrowsETH, totalDebtETH };
}

// Get lendingPool address and the contract
async function getLendingPool(account) {
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    account
  );

  const lendingPoolAddress =
    await lendingPoolAddressesProvider.getLendingPool();
  const lendingPool = await ethers.getContractAt(
    "ILendingPool",
    lendingPoolAddress,
    account
  );

  return lendingPool;
}

// Approve ERC20 token (WETH) to be deposited
async function approveERC20(
  contractAddress,
  spenderAddress,
  amountToSpend,
  account
) {
  const erc20Token = await ethers.getContractAt(
    "IERC20",
    contractAddress,
    account
  );
  const tx = await erc20Token.approve(spenderAddress, amountToSpend);
  await tx.wait(1);
  console.log("Approved!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
