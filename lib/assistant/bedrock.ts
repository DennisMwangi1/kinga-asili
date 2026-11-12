// Bedrock InvokeModel keeps Claude's message/tool format. SDK 0.36 is pinned
// because these models require the bedrock-2023-05-31 wire API version.
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import type Anthropic from "@anthropic-ai/sdk";

type BedrockParams = Parameters<AnthropicBedrock["beta"]["messages"]["stream"]>[0];

export function bedrockCredentialOptions(region: string) {
  const kingaProfile = process.env.KINGA_AWS_PROFILE?.trim();
  if (kingaProfile && process.env.VERCEL !== "1") {
    return { providerChainResolver: async () => fromNodeProviderChain({ profile: kingaProfile, clientConfig: { region } }) };
  }

  const accessKey = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();

  // Environment keys must win over a developer's AWS_PROFILE. The Node
  // provider chain skips environment credentials when a profile is selected.
  if (accessKey || secretKey) {
    if (!accessKey || !secretKey) {
      throw new Error("Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for Kinga AI, then redeploy.");
    }
    return {
      awsAccessKey: accessKey,
      awsSecretKey: secretKey,
      ...(sessionToken ? { awsSessionToken: sessionToken } : {}),
    };
  }

  if (process.env.VERCEL === "1") {
    throw new Error("Kinga AI has no AWS credentials in this Vercel deployment. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for its environment and redeploy. AWS_PROFILE only works on a machine with that local profile.");
  }

  return {
    // Refreshable local profiles, or the workload role on AWS hosting.
    providerChainResolver: async () => fromNodeProviderChain({
      ...(process.env.AWS_PROFILE?.trim() ? { profile: process.env.AWS_PROFILE.trim() } : {}),
      clientConfig: { region },
    }),
  };
}

export function createBedrockClient() {
  const region = process.env.KINGA_AWS_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) throw new Error("AWS_REGION is required for Kinga AI on Bedrock");
  const credentials = bedrockCredentialOptions(region);
  const options = {
    awsRegion: region,
    // This integration uses IAM/SigV4, not a Bedrock bearer token from an
    // unrelated environment. An empty key selects SDK request signing.
    apiKey: "",
    timeout: 120_000,
    maxRetries: 2,
  };
  // The SDK has distinct constructor overloads for key pairs and providers.
  if ("awsAccessKey" in credentials) {
    return new AnthropicBedrock({
      ...options,
      awsAccessKey: credentials.awsAccessKey,
      awsSecretKey: credentials.awsSecretKey,
      awsSessionToken: credentials.awsSessionToken,
    });
  }
  return new AnthropicBedrock({ ...options, providerChainResolver: credentials.providerChainResolver });
}

/** Only the common InvokeModel-supported Claude fields cross this boundary. */
export function bedrockStream(
  client: AnthropicBedrock,
  params: Pick<Anthropic.Beta.Messages.MessageCreateParams, "model" | "max_tokens" | "system" | "tools" | "tool_choice" | "messages">,
  signal?: AbortSignal,
) {
  // The direct SDK is v1; Bedrock's SDK uses v0. Their native message and
  // tool-search blocks share the wire format, but have separate TS types.
  return client.beta.messages.stream({
    ...params,
    betas: ["tool-search-tool-2025-10-19"],
  } as unknown as BedrockParams, { signal });
}
