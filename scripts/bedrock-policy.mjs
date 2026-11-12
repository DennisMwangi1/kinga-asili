// Print a scoped runtime policy. This script does not make AWS changes.
// node scripts/bedrock-policy.mjs ACCOUNT_ID [REGION]
export function bedrockPolicy(account, region = "us-east-1") {
  if (!/^\d{12}$/.test(account || "")) throw new Error("A 12-digit AWS account ID is required");
  if (!/^[a-z]{2}-[a-z]+-\d$/.test(region)) throw new Error("Invalid AWS region");
  const model = "anthropic.claude-opus-4-6-v1";
  const profile = `arn:aws:bedrock:${region}:${account}:inference-profile/global.${model}`;
  const actions = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"];
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "InvokeKingaModelProfile",
        Effect: "Allow",
        Action: actions,
        Resource: profile,
        Condition: { StringEquals: { "aws:RequestedRegion": region } },
      },
      {
        Sid: "InvokeSourceModelThroughProfile",
        Effect: "Allow",
        Action: actions,
        Resource: `arn:aws:bedrock:${region}::foundation-model/${model}`,
        Condition: { StringEquals: { "aws:RequestedRegion": region, "bedrock:InferenceProfileArn": profile } },
      },
      {
        Sid: "InvokeGlobalModelThroughProfile",
        Effect: "Allow",
        Action: actions,
        Resource: `arn:aws:bedrock:::foundation-model/${model}`,
        Condition: { StringEquals: { "aws:RequestedRegion": "unspecified", "bedrock:InferenceProfileArn": profile } },
      },
    ],
  };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    console.log(JSON.stringify(bedrockPolicy(process.argv[2], process.argv[3]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
