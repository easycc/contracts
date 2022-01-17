import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { diffCheck } from "../lib/diffCheck";
import { encodeParameters, sign } from "../lib/sign";
import { loadFarmFromDB } from "./getFarm";

type Body = {
  farmId: number;
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.body) {
    throw new Error("No body found in event");
  }

  const body: Body = JSON.parse(event.body);

  if (!body.farmId) {
    throw new Error("No farmId found in event");
  }

  // TODO - Load the farm at the start of the session - from DB or Blockchain?
  const oldFarm = loadFarmFromDB(body.farmId);

  const newFarm = loadFarmFromDB(body.farmId);

  const changeset = diffCheck({ old: oldFarm, newFarm, id: body.farmId });

  // SunflowerLand.save parameters
  const encodedParameters = encodeParameters(
    [
      "uint256",
      "uint256[]",
      "uint256[]",
      "uint256[]",
      "uint256[]",
      "uint256",
      "uint256",
    ],
    [
      body.farmId,
      changeset.mintIds,
      changeset.mintAmounts,
      changeset.burnIds,
      changeset.burnAmounts,
      changeset.mintTokens,
      changeset.burnTokens,
    ]
  );
  const signature = sign(encodedParameters);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signature,
    }),
  };
};
