import { JsonRpcProvider } from "ethers";
import { RPC_URL } from "@/config/network";

export const fujiProvider = new JsonRpcProvider(RPC_URL, 43113, { staticNetwork: true });
