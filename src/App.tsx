import { useState, useEffect } from "react";
import "./App.css";

import { providers, utils, constants, BigNumber } from "ethers";

// L1 provider
const mainnetProvider = new providers.JsonRpcProvider(
  import.meta.env.VITE_MAINNET_NODE_RPC_URL
);
const sepoliaProvider = new providers.JsonRpcProvider(
  import.meta.env.VITE_SEPOLIA_NODE_RPC_URL
);

// L2 provider
const arbProvider = new providers.JsonRpcProvider(
  import.meta.env.VITE_ARB_MAINNET_NODE_RPC_URL
);
const opProvider = new providers.JsonRpcProvider(
  import.meta.env.VITE_OP_MAINNET_NODE_RPC_URL
);
const arbSepoliaProvider = new providers.JsonRpcProvider(
  import.meta.env.VITE_ARB_SEPOLIA_NODE_RPC_URL
);
const opSepoliaProvider = new providers.JsonRpcProvider(
  import.meta.env.VITE_OP_SEPOLIA_NODE_RPC_URL
);

// Util: Transfer from BigNumber to Float by decimals
export const bigNumberToFloat = (
  bigNumberValue: BigNumber,
  decimals: number
): number => {
  const divisor = BigInt(10 ** decimals);

  const integerPart = bigNumberValue.div(divisor);
  const remainderPart = bigNumberValue.mod(divisor);

  const floatPart = remainderPart.toNumber() / Number(divisor);

  return integerPart.toNumber() + floatPart;
};

// Util: Format BigNumber to String with comma
const formatBigNumber = (value: BigNumber): string => {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Util: BigNumber replacer for JSON stringify
const bigNumberReplacer = (_: string, value: any) => {
  if (
    typeof value === "object" &&
    value !== null &&
    value.type === "BigNumber" &&
    value.hex
  ) {
    return BigNumber.from(value.hex).toString();
  }
  return value;
};

// React: Function component
function App() {
  const [txHashOnArbitrumSepolia, setTXHashOnArbitrumSepolia] =
    useState<string>(
      `0x266a3ab9dabeaa008f09ee7b791d35f192d51958e40688104cc58eb93e72fdf3`
    );
  const [txDataLength, setTxDataLength] = useState<number>(0);
  const [gasUsedForL2, setGasUsedForL2] = useState<BigNumber>(
    BigNumber.from(0)
  );
  const [gasUsedForL1, setGasUsedForL1] = useState<BigNumber>(
    BigNumber.from(0)
  );
  const [baseFeeOnMainnet, setBaseFeeOnMainnet] = useState<BigNumber>(
    BigNumber.from(0)
  );
  const [baseFeeOnArb, setBaseFeeOnArb] = useState<BigNumber>(
    BigNumber.from(0)
  );
  const [errorMsg, setErrorMsg] = useState<string>(``);

  useEffect(() => {
    const asyncFunc = async () => {
      try {
        setErrorMsg(``);
        // Get TX from Arbitrum Sepolia
        const txOnArbitrumSepolia = await arbSepoliaProvider.getTransaction(
          txHashOnArbitrumSepolia
        );

        const txFrom = txOnArbitrumSepolia.from || constants.AddressZero;
        const txTo = txOnArbitrumSepolia.to || constants.AddressZero;
        const txData = txOnArbitrumSepolia.data || utils.hexlify("0x");

        // Calculate gas used for l2
        const gasUsedForL2 = await arbProvider.estimateGas({
          from: txFrom,
          to: txTo,
          data: txData,
        });
        setGasUsedForL2(gasUsedForL2);

        // Get TX data length
        const txDataLength = utils.hexDataLength(txData);
        setTxDataLength(txDataLength);

        // Get base fee on Mainnet
        const baseFeeOnL1Mainnet =
          (await mainnetProvider.getFeeData()).lastBaseFeePerGas ||
          BigNumber.from(0);
        setBaseFeeOnMainnet(baseFeeOnL1Mainnet);

        // Get base fee on Arbitrum
        const feeDataOnL2Arb = await arbProvider.getFeeData();
        console.log(
          `feeDataOnL2Arb: ${JSON.stringify(
            feeDataOnL2Arb,
            bigNumberReplacer,
            2
          )}`
        );
        const baseFeeOnL2Arb =
          feeDataOnL2Arb.lastBaseFeePerGas || BigNumber.from(0);
        setBaseFeeOnArb(baseFeeOnL2Arb);

        // Calculate gas used for l1
        const gasUsedForL1Mainnet = baseFeeOnL1Mainnet
          .div(baseFeeOnL2Arb)
          .mul(txDataLength);
        setGasUsedForL1(gasUsedForL1Mainnet);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        setErrorMsg(errorMessage);
      }
    };

    asyncFunc();
  }, [txHashOnArbitrumSepolia]);

  return (
    <>
      <h1>Estimate Arbitrum Fee from Arbitrum Sepolia TX</h1>
      <div className="card">
        <label>
          TX hash on Arbitrum Sepolia:{" "}
          <input
            type="text"
            style={{ width: "500px" }}
            value={txHashOnArbitrumSepolia}
            onChange={(e) => setTXHashOnArbitrumSepolia(e.target.value)}
            placeholder="e.g., 0x123456..."
          />
        </label>
        <p>
          Link:{" "}
          <a
            href={`https://sepolia.arbiscan.io/tx/${txHashOnArbitrumSepolia}`}
            target="_blank"
          >
            {txHashOnArbitrumSepolia}
          </a>
        </p>
      </div>

      <div className="card">
        <div>
          TX data length: <span>{txDataLength} Bytes</span>
        </div>
        <div>
          Base fee on L1: <span>{formatBigNumber(baseFeeOnMainnet)} WEI</span>
        </div>
        <div>
          Base fee on L2: <span>{formatBigNumber(baseFeeOnArb)} WEI</span>
        </div>

        <div>
          Gas used for L1 (= TX data length * ( Base fee on L1 / Base fee on L2
          )): <span>{formatBigNumber(gasUsedForL1)}</span>
        </div>
        <div>
          Gas used for L2: <span>{formatBigNumber(gasUsedForL2)}</span>
        </div>
        <div>
          Gas limit (= Gas used for L1 + Gas used for L2):{" "}
          <span>{formatBigNumber(gasUsedForL2.add(gasUsedForL1))}</span>
        </div>

        <div>
          Estimate TX fee (= Gas limit * Double base fee):{" "}
          <span>
            {formatBigNumber(
              gasUsedForL2.add(gasUsedForL1).mul(baseFeeOnArb).mul(2)
            )}{" "}
            WEI
          </span>
          <span style={{ color: "gold" }}>
            ={" "}
            {bigNumberToFloat(
              gasUsedForL2.add(gasUsedForL1).mul(baseFeeOnArb).mul(2),
              18
            ).toString()}{" "}
            ETH
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="card" style={{ color: "red" }}>
          <label>
            Error message: <span>{errorMsg}</span>
          </label>
        </div>
      )}
    </>
  );
}

export default App;
